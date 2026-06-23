import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type { Activity } from '../../database/schemas/activity.schema';
import { ActivityService } from '../activity/activity.service';
import { UserProfileSyncService } from '../user/user-profile-sync.service';
import { AmapMapService } from './map/amap.service';
import type { SelectTravelGuideBudgetTierDto } from './dto/select-travel-guide-budget-tier.dto';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import {
  budgetTierLabel,
  parseActivityDayCount,
} from './domain/parse-activity-days.util';
import { buildTravelGuideBudgetItems } from './domain/travel-guide-budget-estimate.util';
import { applyTravelGuideAccommodationPreference } from './domain/travel-guide-accommodation-preference.util';
import { travelGuideRegionKind } from './domain/travel-guide-international.util';
import type {
  TravelGuideBudgetTier,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import { mapCandidatesToLlmFallback } from './map/travel-guide-map-plan.builder';
import { TravelGuidePoiCollector } from './map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './map/travel-guide-poi.ranker';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';

@Injectable()
export class TravelGuideBudgetTierService {
  private readonly logger = new Logger(TravelGuideBudgetTierService.name);

  constructor(
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly activityService: ActivityService,
    private readonly amap: AmapMapService,
    private readonly poiCollector: TravelGuidePoiCollector,
    private readonly poiRanker: TravelGuidePoiRanker,
    private readonly userProfileSync: UserProfileSyncService,
  ) {}

  async selectBudgetTier(
    guideId: string,
    body: SelectTravelGuideBudgetTierDto,
    actor: RequestActor,
  ) {
    if (!this.amap.enabled) {
      throw new ServiceUnavailableException(
        'AI 出行攻略依赖高德地图，请配置 AMAP_KEY 后重试',
      );
    }

    const saved = await this.savedPlanService.findOwnedByGuideId(
      guideId,
      actor.resolvedUserId,
    );
    if (!saved) {
      const exists = await this.savedPlanService.findByGuideId(guideId);
      if (exists) {
        throw new ForbiddenException('无权修改该攻略');
      }
      throw new NotFoundException('攻略不存在或已过期');
    }

    const currentTier = saved.form.budgetTier as
      | TravelGuideBudgetTier
      | undefined;
    if (currentTier === body.budgetTier) {
      return saved;
    }

    const activity = await this.activityService.findByLegacyId(
      saved.activityLegacyId,
    );
    if (!activity) {
      throw new NotFoundException(
        `Activity ${saved.activityLegacyId} not found`,
      );
    }

    const dto = buildDtoFromSavedForm(saved.form, body.budgetTier);
    const accommodationNights =
      dto.accommodationNights ?? parseActivityDayCount(activity.date);

    let updatedPlan = applyBudgetTierFallback(
      saved.plan,
      body.budgetTier,
      dto.headcount,
      accommodationNights,
      activity,
    );
    updatedPlan = applyTravelGuideAccommodationPreference(
      updatedPlan,
      accommodationNights,
    );

    try {
      const mapCtx = await this.poiCollector.collect(activity, dto);
      if (mapCtx && accommodationNights > 0) {
        const ranked = this.poiRanker.rank(mapCtx, dto);
        if (ranked.hotels.length > 0) {
          const mapPayload = mapCandidatesToLlmFallback(mapCtx, ranked, {
            departure: dto.departure.trim(),
            departureCity: dto.departureCity?.trim(),
            selfDrive: Boolean(dto.selfDrive),
            accommodationNights,
            headcount: dto.headcount,
            activity,
          });

          updatedPlan = applyTravelGuideAccommodationPreference(
            {
              ...saved.plan,
              budgetLabel: budgetTierLabel(body.budgetTier),
              accommodation: {
                title: saved.plan.accommodation.title,
                hotels: mapPayload.hotels,
                schemes: mapPayload.accommodationSchemes,
              },
              budget: {
                title: saved.plan.budget?.title ?? '预算参考（全程 · 合计）',
                items:
                  mapPayload.budgetItems ??
                  buildTravelGuideBudgetItems({
                    budgetTier: body.budgetTier,
                    headcount: dto.headcount,
                    accommodationNights,
                    interCity: Boolean(mapCtx.interCity),
                    regionKind: travelGuideRegionKind(activity),
                    selfDrive: Boolean(dto.selfDrive),
                  }),
              },
            },
            accommodationNights,
          );
        }
      }
    } catch (error) {
      this.logger.warn(
        `travel guide budget tier map refresh failed guide=${guideId}: ${
          error instanceof Error ? error.message : error
        }`,
      );
    }

    const result = await this.savedPlanService.updateBudgetTier(
      guideId,
      actor.resolvedUserId,
      body.budgetTier,
      updatedPlan,
    );
    if (!result) {
      throw new NotFoundException('攻略不存在或已过期');
    }

    this.userProfileSync.applyTravelGuideHints(actor, {
      departure: dto.departure,
      departureCity: dto.departureCity,
      budgetTier: body.budgetTier,
    });

    return result;
  }
}

function buildDtoFromSavedForm(
  form: Record<string, unknown>,
  budgetTier: TravelGuideBudgetTier,
): GenerateTravelGuideDto {
  const departure = String(form.departure ?? '').trim();
  const headcount = Number(form.headcount);
  const accommodationNights = Number(form.accommodationNights);

  if (!departure) {
    throw new BadRequestException('攻略表单缺少出发地');
  }
  if (!Number.isFinite(headcount) || headcount <= 0) {
    throw new BadRequestException('攻略表单人数无效');
  }
  if (!Number.isFinite(accommodationNights) || accommodationNights < 0) {
    throw new BadRequestException('攻略表单住宿晚数无效');
  }

  return {
    departure,
    departureCity:
      typeof form.departureCity === 'string' && form.departureCity.trim()
        ? form.departureCity.trim()
        : undefined,
    headcount,
    budgetTier,
    selfDrive: Boolean(form.selfDrive),
    accommodationNights,
  };
}

function applyBudgetTierFallback(
  plan: TravelGuidePlan,
  budgetTier: TravelGuideBudgetTier,
  headcount: number,
  accommodationNights: number,
  activity: Activity,
): TravelGuidePlan {
  const regionKind = travelGuideRegionKind(activity);
  const interCity = plan.transport.lines.some((line) =>
    /机票|高铁|航班|国际|城际/.test(line),
  );

  return {
    ...plan,
    budgetLabel: budgetTierLabel(budgetTier),
    budget: {
      title: plan.budget?.title ?? '预算参考（全程 · 合计）',
      items: buildTravelGuideBudgetItems({
        budgetTier,
        headcount,
        accommodationNights,
        interCity,
        regionKind,
        selfDrive: plan.selfDrive,
      }),
    },
  };
}
