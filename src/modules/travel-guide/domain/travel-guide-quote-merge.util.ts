import type {
  TravelGuideBudgetItem,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import type { TravelQuoteEnrichment } from '../ports/travel-quote.types';
import type { TravelGuideRegionKind } from './travel-guide-international.util';
import { TRAVEL_QUOTE_DISCLAIMER } from './travel-guide-quote.util';
import { isPlausibleHotelNightlyPrice } from './travel-quote-plausibility.util';
import { applyOverseasRollingGoRecommendations } from './travel-guide-rollinggo-recommendations.util';
import { buildRollingGoFlightBudgetItem } from './travel-guide-flight-budget.util';
import { isFlightBudgetItem } from './travel-guide-flight-budget-detect.util';
import { isRollingGoFlightSampleLine } from './travel-guide-flight-itinerary.util';
import {
  attachBudgetTierSnapshots,
  buildBudgetTierSnapshotsFromSources,
  findBudgetTierSnapshot,
} from './travel-guide-budget-tier-ranges.util';
import {
  buildPlanFlightByTier,
  normalizeFlightTierQuotesMonotonic,
} from './travel-guide-flight-tier.util';
import {
  applyHotelTierAccommodationToPlan,
  buildPlanHotelByTierFromQuotes,
} from './travel-guide-hotel-tier.util';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';

function formatRange(min: number, max: number): string {
  const a = Math.round(min);
  const b = Math.round(max);
  if (a === b) return `约 ¥${a}`;
  return `约 ¥${a}–${b}`;
}

function roomCount(headcount: number): number {
  if (headcount <= 1) return 1;
  return Math.ceil(headcount / 2);
}

function replaceFlightBudgetItem(
  items: TravelGuideBudgetItem[],
  patch: TravelGuideBudgetItem,
): void {
  const firstFlightIdx = items.findIndex(isFlightBudgetItem);
  const withoutFlights = items.filter((item) => !isFlightBudgetItem(item));
  if (firstFlightIdx >= 0) {
    withoutFlights.splice(firstFlightIdx, 0, patch);
  } else {
    withoutFlights.unshift(patch);
  }
  items.splice(0, items.length, ...withoutFlights);
}

function shouldApplyFlightQuote(
  enrichment: NonNullable<TravelQuoteEnrichment['flight']>,
): boolean {
  return enrichment.minPricePerAdult > 0 && enrichment.maxPricePerAdult > 0;
}

function replaceBudgetItem(
  items: TravelGuideBudgetItem[],
  labelPrefix: string,
  patch: TravelGuideBudgetItem,
): void {
  const idx = items.findIndex((item) => item.label.startsWith(labelPrefix));
  if (idx >= 0) {
    items[idx] = patch;
    return;
  }
  items.push(patch);
}

function recalculateBudgetTotal(
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
    range: formatRange(subtotalMin, subtotalMax),
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

export type TravelQuoteEnrichmentProtect = {
  /** Keep selected flight offers / transport lead lines from being overwritten. */
  selectedFlight?: boolean;
  /** Keep selected hotel accommodation from being overwritten. */
  selectedHotel?: boolean;
  /** Keep BudgetService items from being overwritten. */
  budget?: boolean;
  /** Keep LLM itinerary/tips/nightlife from being overwritten. */
  itinerary?: boolean;
};

/**
 * @deprecated Prefer attachQuoteTierMetadataToPlan for generation/cache/refresh.
 * Still used by budget-tier lazy hotel quote path which intentionally rewrites
 * accommodation for the newly selected tier.
 */
export function applyTravelQuoteEnrichment(
  plan: TravelGuidePlan,
  enrichment: TravelQuoteEnrichment | null | undefined,
  input: {
    headcount: number;
    accommodationNights: number;
    regionKind: TravelGuideRegionKind;
    interCity: boolean;
    budgetTier?: TravelGuideBudgetTier;
  },
  protect: TravelQuoteEnrichmentProtect = {},
): TravelGuidePlan {
  if (
    !enrichment?.flight &&
    !enrichment?.hotel &&
    !enrichment?.flightByTier &&
    !enrichment?.hotelByTier
  ) {
    return attachBudgetTierSnapshots(plan, enrichment, {
      selectedBudgetTier: input.budgetTier,
    });
  }

  const items =
    protect.budget && plan.budget?.items?.length
      ? plan.budget.items.map((item) => ({ ...item }))
      : plan.budget?.items?.length
        ? plan.budget.items.map((item) => ({ ...item }))
        : [];
  let transportLines = [...plan.transport.lines];
  let accommodation = plan.accommodation;
  const flightOffers = protect.selectedFlight
    ? plan.transport.flightOffers
    : enrichment.flight?.flightOffers;

  if (
    !protect.budget &&
    enrichment.flight &&
    shouldApplyFlightQuote(enrichment.flight)
  ) {
    const flightItem = buildRollingGoFlightBudgetItem(enrichment.flight, {
      headcount: input.headcount,
      regionKind: input.regionKind,
    });
    replaceFlightBudgetItem(items, flightItem);

    if (!protect.selectedFlight && !flightOffers?.length) {
      const sampleLines = enrichment.flight.sampleLines ?? [];
      const existing = new Set(transportLines);
      const newFlightLines = sampleLines.filter((line) => !existing.has(line));
      if (input.regionKind !== 'overseas' && newFlightLines.length) {
        transportLines = [...newFlightLines, ...transportLines];
      }
    }
  } else if (
    protect.selectedFlight &&
    enrichment.flight &&
    !flightOffers?.length &&
    enrichment.flight.sampleLines?.length &&
    input.regionKind !== 'overseas'
  ) {
    // Fill-only: append missing sample lines without replacing lead selection line.
    const existing = new Set(transportLines);
    const extras = enrichment.flight.sampleLines.filter(
      (line) => !existing.has(line),
    );
    if (extras.length) {
      transportLines = [...transportLines, ...extras];
    }
  }

  if (
    !protect.budget &&
    items.length &&
    enrichment.hotel &&
    input.accommodationNights > 0 &&
    enrichment.hotel.minPricePerNight > 0 &&
    isPlausibleHotelNightlyPrice(
      enrichment.hotel.minPricePerNight,
      enrichment.hotel.currency,
    ) &&
    isPlausibleHotelNightlyPrice(
      enrichment.hotel.maxPricePerNight,
      enrichment.hotel.currency,
    )
  ) {
    const rooms = roomCount(input.headcount);
    const nights = input.accommodationNights;
    const snapshots = buildBudgetTierSnapshotsFromSources({
      enrichment,
      plan: { ...plan, accommodation },
    });
    const tier = input.budgetTier ?? 'standard';
    const tierSnap = findBudgetTierSnapshot(tier, snapshots);
    const nightlyMin =
      tierSnap?.nightlyMin ?? enrichment.hotel.minPricePerNight;
    const nightlyMax =
      tierSnap?.nightlyMax ?? enrichment.hotel.maxPricePerNight;
    replaceBudgetItem(items, '住宿', {
      label: '住宿',
      range: formatRange(
        nightlyMin * rooms * nights,
        nightlyMax * rooms * nights,
      ),
      note: `${TRAVEL_QUOTE_DISCLAIMER} 按 ${rooms} 间房 · ${nights} 晚 · ${
        tier === 'economy' ? '经济' : tier === 'comfort' ? '豪华' : '舒适'
      }档估算。`,
    });
  }

  if (!protect.budget && items.length) {
    recalculateBudgetTotal(items, input.headcount);
  }

  if (input.regionKind === 'overseas' && !protect.selectedHotel) {
    const overseasPatch = applyOverseasRollingGoRecommendations(plan, {
      headcount: input.headcount,
      accommodationNights: input.accommodationNights,
      currency:
        enrichment.hotel?.currency ?? enrichment.flight?.currency ?? 'CNY',
      flightSampleLines:
        !protect.selectedFlight &&
        !flightOffers?.length &&
        enrichment.flight?.sampleLines?.length &&
        enrichment.flight.sampleLines.length > 0
          ? enrichment.flight.sampleLines
          : undefined,
      hotelRecommendations: enrichment.hotel?.recommendations,
    });
    if (overseasPatch) {
      if (!protect.selectedFlight) {
        transportLines = overseasPatch.transport.lines;
      }
      accommodation = overseasPatch.accommodation;
    }
  }

  if (flightOffers?.length && !protect.selectedFlight) {
    transportLines = transportLines.filter(
      (line) => !isRollingGoFlightSampleLine(line),
    );
  }

  const rawFlightByTier = enrichment.flightByTier
    ? buildPlanFlightByTier(enrichment.flightByTier)
    : plan.flightByTier;
  const flightByTier = rawFlightByTier
    ? normalizeFlightTierQuotesMonotonic(rawFlightByTier)
    : undefined;
  const builtHotelByTier = enrichment.hotelByTier
    ? buildPlanHotelByTierFromQuotes(enrichment.hotelByTier, {
        accommodationNights: input.accommodationNights,
        headcount: input.headcount,
      })
    : undefined;
  const hotelByTier = builtHotelByTier
    ? { ...(plan.hotelByTier ?? {}), ...builtHotelByTier }
    : plan.hotelByTier;
  const selectedTier = input.budgetTier ?? 'standard';
  const planWithTierData = attachBudgetTierSnapshots(
    {
      ...plan,
      transport: {
        ...plan.transport,
        lines: transportLines,
        ...(flightOffers?.length
          ? { flightOffers }
          : plan.transport.flightOffers
            ? { flightOffers: plan.transport.flightOffers }
            : {}),
      },
      accommodation,
      budget: {
        title: plan.budget?.title ?? '预算参考（全程 · 合计）',
        items:
          protect.budget && plan.budget?.items?.length
            ? plan.budget.items
            : items,
      },
      quoteFetchedAt: new Date().toISOString(),
      ...(flightByTier ? { flightByTier } : {}),
      ...(hotelByTier ? { hotelByTier } : {}),
    },
    enrichment,
    { selectedBudgetTier: input.budgetTier },
  );

  if (!protect.selectedHotel && hotelByTier?.[selectedTier]?.hotels.length) {
    return applyHotelTierAccommodationToPlan(planWithTierData, selectedTier);
  }

  return planWithTierData;
}
