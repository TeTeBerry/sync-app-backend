import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ActivityService } from '../activity/activity.service';
import { AmapMapService } from './map/amap.service';
import { parseActivityDayCount } from './domain/parse-activity-days.util';
import { buildTravelGuideBudgetItems } from './domain/travel-guide-budget-estimate.util';
import {
  normalizeBudgetTierSnapshotsMonotonic,
  formatBudgetTierLabel,
} from './domain/travel-guide-budget-tier-ranges.util';
import { applyTravelGuideAccommodationPreference } from './domain/travel-guide-accommodation-preference.util';
import {
  travelGuideRegionKind,
  type TravelGuideRegionKind,
} from './domain/travel-guide-international.util';
import { mapCandidatesToLlmFallback } from './map/travel-guide-map-plan.builder';
import { TravelGuidePoiCollector } from './map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './map/travel-guide-poi.ranker';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import type { TravelGuideSavedPlanView } from './travel-guide-saved-plan.service';
import { buildDtoFromSavedForm } from './domain/travel-guide-saved-form.util';
import { buildMinimalMapContextForQuote } from './domain/travel-guide-quote-map-context.util';
import { applyTravelQuoteEnrichment } from './domain/travel-guide-quote-merge.util';
import { applyHotelTierAccommodationToPlan } from './domain/travel-guide-hotel-tier.util';
import {
  applyFlightTierQuoteToPlan,
  mergeFlightTierQuoteIntoPlan,
} from './domain/travel-guide-flight-tier.util';
import { isFlightBudgetItem } from './domain/travel-guide-flight-budget-detect.util';
import { shouldFetchTravelQuote } from './domain/travel-guide-quote.util';
import { TravelQuoteEnrichmentService } from './travel-quote-enrichment.service';
import { missingFlightBudgetTiers } from './domain/travel-guide-budget-tier-quote.util';
import {
  shouldFetchHotelQuoteForTier,
  shouldRefreshAccommodationFromMap,
} from './domain/travel-guide-budget-tier-accommodation.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type {
  TravelGuideBudgetItem,
  TravelGuideBudgetTier,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import type { TravelGuideMapContext } from './map/travel-guide-map.types';
import type { Activity } from '../../database/schemas/activity.schema';

@Injectable()
export class TravelGuideBudgetTierService {
  private readonly logger = new Logger(TravelGuideBudgetTierService.name);

  constructor(
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly activityService: ActivityService,
    private readonly amap: AmapMapService,
    private readonly poiCollector: TravelGuidePoiCollector,
    private readonly poiRanker: TravelGuidePoiRanker,
    private readonly quoteEnrichment: TravelQuoteEnrichmentService,
  ) {}

  async selectBudgetTier(
    guideId: string,
    body: { budgetTier: TravelGuideBudgetTier },
    actor: RequestActor,
  ): Promise<TravelGuideSavedPlanView> {
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

    const currentTier = saved.form.budgetTier;
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

    const dto: GenerateTravelGuideDto = buildDtoFromSavedForm(
      saved.form,
      body.budgetTier,
    );

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

    updatedPlan = applyHotelTierAccommodationToPlan(
      updatedPlan,
      body.budgetTier,
    );

    const regionKind = travelGuideRegionKind(activity);
    const mapCtxForQuote = buildMinimalMapContextForQuote(
      updatedPlan,
      activity,
      dto,
    );
    const quoteEligible = shouldFetchTravelQuote(activity, dto, mapCtxForQuote);

    const interCity =
      updatedPlan.transport.lines.some((line) =>
        /机票|高铁|航班|国际|城际/.test(line),
      ) || Boolean(updatedPlan.flightByTier);

    // Lazy-load missing flight tier quotes
    const missingFlightTiersList = quoteEligible
      ? missingFlightBudgetTiers(updatedPlan)
      : [];

    if (missingFlightTiersList.length) {
      try {
        const tierQuotes = await Promise.all(
          missingFlightTiersList.map(async (tier) => ({
            tier,
            quote: await this.quoteEnrichment.fetchFlightQuoteForTier(
              activity,
              dto,
              mapCtxForQuote,
              accommodationNights,
              tier,
            ),
          })),
        );

        for (const { tier, quote } of tierQuotes) {
          if (!quote) continue;
          updatedPlan = mergeFlightTierQuoteIntoPlan(updatedPlan, tier, quote);
        }
      } catch (error) {
        this.logger.warn(
          `travel guide budget tier lazy flight quote failed guide=${guideId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    updatedPlan = applyFlightTierQuoteToPlan(updatedPlan, body.budgetTier, {
      headcount: dto.headcount,
      regionKind,
      interCity,
    });

    if (updatedPlan.budget?.items?.length) {
      recalculateBudgetTotalItems(updatedPlan.budget.items, dto.headcount);
    }

    // Lazy-load hotel quote if needed for this tier
    if (shouldFetchHotelQuoteForTier(updatedPlan, body.budgetTier)) {
      try {
        const mapCtx = buildMinimalMapContextForQuote(
          updatedPlan,
          activity,
          dto,
        );
        const hotelQuote = await this.quoteEnrichment.fetchHotelQuoteForTier(
          activity,
          dto,
          mapCtx,
          accommodationNights,
          body.budgetTier,
        );

        if (hotelQuote) {
          updatedPlan = applyTravelQuoteEnrichment(
            updatedPlan,
            {
              hotel: hotelQuote,
              hotelByTier: { [body.budgetTier]: hotelQuote },
            },
            {
              headcount: dto.headcount,
              accommodationNights,
              regionKind: travelGuideRegionKind(activity),
              interCity: Boolean(mapCtx.interCity),
              budgetTier: body.budgetTier,
            },
          );

          updatedPlan = applyTravelGuideAccommodationPreference(
            updatedPlan,
            accommodationNights,
          );
        }
      } catch (error) {
        this.logger.warn(
          `travel guide budget tier lazy hotel quote failed guide=${guideId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
      }
    }

    // Refresh accommodation from map if needed
    if (shouldRefreshAccommodationFromMap(updatedPlan, body.budgetTier)) {
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
                ...updatedPlan,
                accommodation: {
                  title: updatedPlan.accommodation.title,
                  hotels: mapPayload.hotels,
                  schemes: mapPayload.accommodationSchemes,
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
    }

    // Re-apply flight tier quote for the selected tier after all enrichments
    updatedPlan = applyFlightTierQuoteToPlan(updatedPlan, body.budgetTier, {
      headcount: dto.headcount,
      regionKind,
      interCity,
    });

    if (updatedPlan.budget?.items?.length) {
      recalculateBudgetTotalItems(updatedPlan.budget.items, dto.headcount);
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

    return result;
  }
}

function applyBudgetTierFallback(
  plan: TravelGuidePlan,
  budgetTier: TravelGuideBudgetTier,
  headcount: number,
  accommodationNights: number,
  activity: Pick<Activity, 'region' | 'name' | 'location'>,
): TravelGuidePlan {
  const regionKind: TravelGuideRegionKind = travelGuideRegionKind(activity);
  const interCity = plan.transport.lines.some((line) =>
    /机票|高铁|航班|国际|城际/.test(line),
  );

  const snapshots =
    plan.budgetTierSnapshots?.length === 3
      ? normalizeBudgetTierSnapshotsMonotonic(plan.budgetTierSnapshots)
      : plan.budgetTierSnapshots;

  const freshItems = buildTravelGuideBudgetItems({
    budgetTier,
    headcount,
    accommodationNights,
    interCity,
    regionKind,
    selfDrive: plan.selfDrive ?? false,
    budgetTierSnapshots: snapshots,
  });

  const existingItems = plan.budget?.items ?? [];
  const preservedItems = existingItems.filter(
    (item) =>
      !item.label.startsWith('住宿') &&
      !item.label.startsWith('合计') &&
      !(plan.flightByTier && isFlightBudgetItem(item)),
  );

  const accommodationItem = freshItems.find((item) => item.label === '住宿');
  const items: TravelGuideBudgetItem[] =
    preservedItems.length > 0
      ? [...preservedItems, ...(accommodationItem ? [accommodationItem] : [])]
      : freshItems.filter((item) => !item.label.startsWith('合计'));

  if (items.length) {
    recalculateBudgetTotalItems(items, headcount);
  }

  return {
    ...plan,
    budgetLabel: formatBudgetTierLabel(budgetTier, snapshots),
    budgetTierSnapshots: snapshots,
    budget: {
      title: plan.budget?.title ?? '预算参考（全程 · 合计）',
      items: items.length ? items : freshItems,
    },
  };
}

function recalculateBudgetTotalItems(
  items: TravelGuideBudgetItem[],
  headcount: number,
): void {
  const subtotalMin = items.reduce((sum, item) => {
    if (item.label.startsWith('合计')) return sum;
    const nums = item.range.match(/\d+/g)?.map(Number) ?? [];
    return sum + (nums[0] ?? 0);
  }, 0);

  const subtotalMax = items.reduce((sum, item) => {
    if (item.label.startsWith('合计')) return sum;
    const nums = item.range.match(/\d+/g)?.map(Number) ?? [];
    const max = nums.length > 1 ? nums[nums.length - 1]! : (nums[0] ?? 0);
    return sum + max;
  }, 0);

  const totalLabel = headcount > 1 ? '合计参考（全员）' : '合计参考（单人）';
  const totalIdx = items.findIndex((item) => item.label.startsWith('合计'));
  const totalItem: TravelGuideBudgetItem = {
    label: totalLabel,
    range:
      subtotalMin === subtotalMax
        ? `约 ¥${subtotalMin}`
        : `约 ¥${subtotalMin}–${subtotalMax}`,
    note:
      headcount > 1
        ? `以上各项为本次出行合计估算（${headcount} 人）。`
        : '以上各项为单人合计估算。',
  };

  if (totalIdx >= 0) {
    items[totalIdx] = totalItem;
  } else {
    items.push(totalItem);
  }
}
