import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  assertUserUgcTexts,
  collectTravelGuideUgcTexts,
} from '../../common/media/user-ugc-text.util';
import { ActivityService } from '../activity/activity.service';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { UserProfileSyncService } from '../user/user-profile-sync.service';
import { AmapMapService } from './map/amap.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import { buildTravelGuidePlan } from './domain/travel-guide-fallback.builder';
import {
  parseActivityDayCount,
  resolveTravelGuideBudgetTier,
} from './domain/parse-activity-days.util';
import type { TravelGuidePlan } from './domain/travel-guide.types';
import {
  resolveTravelGuideSupported,
  TRAVEL_GUIDE_PREPARING_MESSAGE,
} from './domain/travel-guide-support.util';
import { applyTravelGuideAccommodationPreference } from './domain/travel-guide-accommodation-preference.util';
import { TravelGuidePoiPipeline } from './map/travel-guide-poi.pipeline';
import { TravelGuideLlmPolishService } from './travel-guide-llm-polish.service';
import { TravelGuideGenerationCacheService } from './travel-guide-generation-cache.service';
import { TravelGuideGuardService } from './travel-guide-guard.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
} from './domain/travel-guide-generation-cache.util';

@Injectable()
export class TravelGuideGenerationOrchestrator {
  private readonly logger = new Logger(TravelGuideGenerationOrchestrator.name);

  constructor(
    private readonly activityService: ActivityService,
    private readonly amap: AmapMapService,
    private readonly poiPipeline: TravelGuidePoiPipeline,
    private readonly llmPolish: TravelGuideLlmPolishService,
    private readonly generationCache: TravelGuideGenerationCacheService,
    private readonly travelGuideGuard: TravelGuideGuardService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly userProfileSync: UserProfileSyncService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
  ) {}

  async generate(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
    if (!this.amap.enabled) {
      throw new ServiceUnavailableException(
        'AI 出行攻略依赖高德地图，请配置 AMAP_KEY 后重试',
      );
    }

    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    if (!resolveTravelGuideSupported(activity)) {
      throw new BadRequestException(TRAVEL_GUIDE_PREPARING_MESSAGE);
    }

    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectTravelGuideUgcTexts(dto),
    );

    const accommodationNights =
      dto.accommodationNights ?? parseActivityDayCount(activity.date);

    const generationDto: GenerateTravelGuideDto = {
      ...dto,
      accommodationNights,
      budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    };

    const cacheParams = normalizeTravelGuideGenerationParams(
      activityLegacyId,
      generationDto,
      accommodationNights,
    );
    const cacheKey = buildTravelGuideGenerationCacheKey(cacheParams);
    const cachedPlan = await this.generationCache.findPlan(cacheKey);
    if (cachedPlan) {
      this.logger.log(
        `travel guide cache hit activity=${activityLegacyId} key=${cacheKey.slice(0, 8)}`,
      );
      return this.finishWithPlan(
        dto,
        accommodationNights,
        actor,
        activityLegacyId,
        applyTravelGuideAccommodationPreference(
          cachedPlan,
          accommodationNights,
        ),
      );
    }

    const fuzzyPlan = await this.generationCache.findSimilarPlan(cacheParams);
    if (fuzzyPlan) {
      return this.finishWithPlan(
        dto,
        accommodationNights,
        actor,
        activityLegacyId,
        applyTravelGuideAccommodationPreference(fuzzyPlan, accommodationNights),
      );
    }

    await this.travelGuideGuard.assertCanGenerate(
      actor.resolvedUserId,
      activityLegacyId,
    );

    const lockAcquired = await this.travelGuideGuard.acquireGenerationLock(
      actor.resolvedUserId,
      activityLegacyId,
      generationDto,
      accommodationNights,
    );
    if (!lockAcquired) {
      const racingPlan =
        (await this.generationCache.findPlan(cacheKey)) ??
        (await this.generationCache.findSimilarPlan(cacheParams));
      if (racingPlan) {
        return this.finishWithPlan(
          dto,
          accommodationNights,
          actor,
          activityLegacyId,
          applyTravelGuideAccommodationPreference(
            racingPlan,
            accommodationNights,
          ),
        );
      }
      throw new ServiceUnavailableException(
        '相同参数的攻略正在生成中，请稍后再试',
      );
    }

    try {
      const { mapCtx, ranked } = await this.poiPipeline.run(
        activity,
        generationDto,
        accommodationNights,
      );

      const llmPayload = await this.llmPolish.buildPayloadFromMap(
        activity,
        generationDto,
        accommodationNights,
        mapCtx,
        ranked,
      );

      const plan = applyTravelGuideAccommodationPreference(
        buildTravelGuidePlan({
          activity,
          departure: generationDto.departure.trim(),
          headcount: generationDto.headcount,
          budgetTier: generationDto.budgetTier!,
          accommodationNights,
          selfDrive: generationDto.selfDrive,
          llm: llmPayload,
          mapSourcedOnly: true,
          interCity: Boolean(mapCtx.interCity),
        }),
        accommodationNights,
      );

      await this.generationCache.savePlan(
        cacheKey,
        activityLegacyId,
        cacheParams,
        plan,
      );

      return this.finishWithPlan(
        dto,
        accommodationNights,
        actor,
        activityLegacyId,
        plan,
      );
    } finally {
      await this.travelGuideGuard.releaseGenerationLock(
        actor.resolvedUserId,
        activityLegacyId,
        generationDto,
        accommodationNights,
      );
    }
  }

  private async finishWithPlan(
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    actor: RequestActor,
    activityLegacyId: number,
    plan: TravelGuidePlan,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
    this.userProfileSync.applyTravelGuideHints(actor, {
      departure: dto.departure,
      departureCity: dto.departureCity,
    });

    const guideId = await this.persistSavedPlanIfRequested(
      dto,
      accommodationNights,
      actor.resolvedUserId,
      activityLegacyId,
      plan,
    );
    return guideId ? { plan, guideId } : { plan };
  }

  private async persistSavedPlanIfRequested(
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    ownerUserId: string,
    activityLegacyId: number,
    plan: TravelGuidePlan,
  ): Promise<string | undefined> {
    const guideId = dto.guideId?.trim();
    if (!guideId) return undefined;

    await this.savedPlanService.upsert(
      guideId,
      ownerUserId,
      activityLegacyId,
      dto,
      accommodationNights,
      plan,
    );
    return guideId;
  }
}
