import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import type { AiGuidePlanFormValues } from '@sync/travel-guide-contracts';
import { ActivityService } from '../activity/activity.service';
import { applyTravelGuideAccommodationPreference } from './domain/travel-guide-accommodation-preference.util';
import {
  hasRollingGoFlightBudget,
  hasStaticFlightBudgetTemplate,
} from './domain/travel-guide-flight-budget-detect.util';
import { planHasFullFlightTierQuotes } from './domain/travel-guide-budget-tier-quote.util';
import { travelGuideRegionKind } from './domain/travel-guide-international.util';
import { resolveTravelGuideBudgetTier } from './domain/parse-activity-days.util';
import { applyTravelQuoteEnrichment } from './domain/travel-guide-quote-merge.util';
import { buildMinimalMapContextForQuote } from './domain/travel-guide-quote-map-context.util';
import {
  isPlanQuoteFresh,
  resolveQuoteCacheTtlMs,
} from './domain/travel-guide-quote-freshness.util';
import { shouldFetchTravelQuote } from './domain/travel-guide-quote.util';
import { buildDtoFromSavedForm } from './domain/travel-guide-saved-form.util';
import { TravelQuoteEnrichmentService } from './travel-quote-enrichment.service';

@Injectable()
export class TravelGuideQuoteRefreshService {
  private readonly logger = new Logger(TravelGuideQuoteRefreshService.name);

  constructor(
    private readonly activityService: ActivityService,
    private readonly config: ConfigService,
    private readonly quoteEnrichment: TravelQuoteEnrichmentService,
  ) {}

  needsFlightQuoteRefresh(
    plan: TravelGuidePlan,
    quoteEligible: boolean,
  ): boolean {
    if (!quoteEligible) return false;

    const items = plan.budget?.items ?? [];
    const hasFlightLine = items.some((item) =>
      /机票|城际|航班/.test(item.label),
    );
    if (!hasFlightLine && !plan.flightByTier) return false;

    if (hasRollingGoFlightBudget(items) && planHasFullFlightTierQuotes(plan)) {
      return false;
    }

    return (
      hasStaticFlightBudgetTemplate(items) ||
      hasFlightLine ||
      !planHasFullFlightTierQuotes(plan)
    );
  }

  async refreshSavedPlanQuotes(input: {
    plan: TravelGuidePlan;
    activityLegacyId: number;
    form: AiGuidePlanFormValues;
    accommodationNights: number;
  }): Promise<TravelGuidePlan> {
    const activity = await this.activityService.findByLegacyId(
      input.activityLegacyId,
    );
    if (!activity) return input.plan;

    const regionKind = travelGuideRegionKind(activity);
    const dto = buildDtoFromSavedForm(input.form);
    const mapCtx = buildMinimalMapContextForQuote(input.plan, activity, dto);
    const quoteEligible = shouldFetchTravelQuote(activity, dto, mapCtx);
    if (!this.needsFlightQuoteRefresh(input.plan, quoteEligible)) {
      return input.plan;
    }

    if (!quoteEligible) {
      return input.plan;
    }

    const quoteTtlMs = resolveQuoteCacheTtlMs(
      this.config.get<number>('rollinggo.quoteCacheTtlSec'),
    );
    if (isPlanQuoteFresh(input.plan, quoteTtlMs)) {
      return input.plan;
    }

    this.logger.log(
      `refresh RollingGo quotes for saved plan activity=${input.activityLegacyId}`,
    );

    const quoteSnapshot = await this.quoteEnrichment.run(
      activity,
      dto,
      mapCtx,
      input.accommodationNights,
    );
    if (
      !quoteSnapshot?.flight &&
      !quoteSnapshot?.hotel &&
      !quoteSnapshot?.flightByTier
    ) {
      return input.plan;
    }

    const enriched = applyTravelQuoteEnrichment(input.plan, quoteSnapshot, {
      headcount: dto.headcount,
      accommodationNights: input.accommodationNights,
      regionKind,
      interCity: true,
      budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    });

    return applyTravelGuideAccommodationPreference(
      enriched,
      input.accommodationNights,
    );
  }
}
