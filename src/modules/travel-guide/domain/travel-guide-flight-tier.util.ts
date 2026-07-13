import type {
  TravelGuideBudgetTier,
  TravelGuideFlightOffer,
  TravelGuideFlightTierQuote,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import type { FlightQuoteSnapshot } from '../ports/travel-quote.types';
import { buildRollingGoFlightBudgetItem } from './travel-guide-flight-budget.util';
import { isFlightBudgetItem } from './travel-guide-flight-budget-detect.util';
import type { TravelGuideRegionKind } from './travel-guide-international.util';
import { isRollingGoFlightSampleLine } from './travel-guide-flight-itinerary.util';
import { SYNC_BUDGET_TIER_ORDER } from './travel-guide-rollinggo-flight-tier.util';
import { resolveTravelGuideLocale } from './travel-guide-locale';

function roundPrice(value: number): number {
  return value >= 1000 ? Math.round(value / 10) * 10 : Math.round(value);
}

function areSameFlightTierQuotes(
  a: TravelGuideFlightTierQuote,
  b: TravelGuideFlightTierQuote,
): boolean {
  return (
    roundPrice(a.minPricePerAdult) === roundPrice(b.minPricePerAdult) &&
    roundPrice(a.maxPricePerAdult) === roundPrice(b.maxPricePerAdult) &&
    a.cabinLabel === b.cabinLabel &&
    (a.fromCityCode ?? '') === (b.fromCityCode ?? '') &&
    (a.toCityCode ?? '') === (b.toCityCode ?? '')
  );
}

export function flightQuoteToTierQuote(
  flight: FlightQuoteSnapshot,
): TravelGuideFlightTierQuote {
  return {
    cabinLabel: flight.cabinLabel ?? 'Economy',
    minPricePerAdult: flight.minPricePerAdult,
    maxPricePerAdult: flight.maxPricePerAdult,
    currency: flight.currency,
    flightOffers: flight.flightOffers,
    sampleLines: flight.sampleLines,
    fromCityCode: flight.fromCityCode,
    toCityCode: flight.toCityCode,
    requestedCabinLabel: flight.requestedCabinLabel,
    cabinFallback: flight.cabinFallback,
  };
}

export function buildPlanFlightByTier(
  flightByTier?: Partial<Record<TravelGuideBudgetTier, FlightQuoteSnapshot>>,
): TravelGuidePlan['flightByTier'] | undefined {
  if (!flightByTier) return undefined;

  const planFlightByTier: NonNullable<TravelGuidePlan['flightByTier']> = {};
  for (const tier of SYNC_BUDGET_TIER_ORDER) {
    const quote = flightByTier[tier];
    if (quote) {
      planFlightByTier[tier] = flightQuoteToTierQuote(quote);
    }
  }

  return Object.keys(planFlightByTier).length ? planFlightByTier : undefined;
}

export function normalizeFlightTierQuotesMonotonic(
  quotes: Partial<Record<TravelGuideBudgetTier, TravelGuideFlightTierQuote>>,
): Partial<Record<TravelGuideBudgetTier, TravelGuideFlightTierQuote>> {
  if (SYNC_BUDGET_TIER_ORDER.filter((tier) => quotes[tier]).length < 2) {
    return quotes;
  }

  const normalized: Partial<
    Record<TravelGuideBudgetTier, TravelGuideFlightTierQuote>
  > = {};

  for (let i = 0; i < SYNC_BUDGET_TIER_ORDER.length; i++) {
    const tier = SYNC_BUDGET_TIER_ORDER[i]!;
    const source = quotes[tier];
    if (!source) continue;

    let min = roundPrice(source.minPricePerAdult);
    let max = roundPrice(source.maxPricePerAdult);
    if (max < min) max = min;

    if (i > 0) {
      const prevTier = SYNC_BUDGET_TIER_ORDER[i - 1]!;
      const prevSource = quotes[prevTier];
      const prev = normalized[prevTier];
      const sameAsPrevSource =
        prevSource != null && areSameFlightTierQuotes(source, prevSource);

      if (prev && !sameAsPrevSource) {
        if (min < prev.maxPricePerAdult) {
          min = roundPrice(prev.maxPricePerAdult);
        }
        if (max < min) {
          const bump = Math.max(10, Math.round(min * 0.08));
          max = roundPrice(min + bump);
        }
      }
    }

    normalized[tier] = {
      ...source,
      minPricePerAdult: min,
      maxPricePerAdult: max,
    };
  }

  return normalized;
}

export function resolveFlightQuoteForTier(
  flightByTier:
    | Partial<Record<TravelGuideBudgetTier, FlightQuoteSnapshot>>
    | undefined,
  tier: TravelGuideBudgetTier,
  fallback?: FlightQuoteSnapshot,
): FlightQuoteSnapshot | undefined {
  return flightByTier?.[tier] ?? fallback;
}

export function tierQuoteToFlightSnapshot(
  tierQuote: TravelGuideFlightTierQuote,
  base?: FlightQuoteSnapshot,
): FlightQuoteSnapshot {
  return {
    fromCityCode: tierQuote.fromCityCode ?? base?.fromCityCode ?? '',
    toCityCode: tierQuote.toCityCode ?? base?.toCityCode ?? '',
    outboundDate: base?.outboundDate ?? '',
    returnDate: base?.returnDate,
    currency: tierQuote.currency,
    minPricePerAdult: tierQuote.minPricePerAdult,
    maxPricePerAdult: tierQuote.maxPricePerAdult,
    sampleLines: tierQuote.sampleLines ?? [],
    flightOffers: tierQuote.flightOffers,
    cabinLabel: tierQuote.cabinLabel,
    requestedCabinLabel: tierQuote.requestedCabinLabel,
    cabinFallback: tierQuote.cabinFallback,
    fetchedAt: base?.fetchedAt ?? new Date().toISOString(),
    source: 'rollinggo',
  };
}

export function mergeFlightTierQuoteIntoPlan(
  plan: TravelGuidePlan,
  tier: TravelGuideBudgetTier,
  quote: FlightQuoteSnapshot,
): TravelGuidePlan {
  const merged = normalizeFlightTierQuotesMonotonic({
    ...(plan.flightByTier ?? {}),
    [tier]: flightQuoteToTierQuote(quote),
  });

  return {
    ...plan,
    flightByTier: merged,
  };
}

export function applyFlightTierQuoteToPlan(
  plan: TravelGuidePlan,
  tier: TravelGuideBudgetTier,
  input: {
    headcount: number;
    regionKind: TravelGuideRegionKind;
    interCity: boolean;
  },
): TravelGuidePlan {
  const tierQuote = plan.flightByTier?.[tier];
  if (!tierQuote) return plan;

  const flightSnapshot = tierQuoteToFlightSnapshot(tierQuote);
  const items = plan.budget?.items?.length
    ? plan.budget.items.map((item) => ({ ...item }))
    : [];
  const locale = resolveTravelGuideLocale(
    /Estimated total|Accommodation\b|Flights\b/i.test(
      [
        plan.budget?.title,
        plan.budgetLabel,
        ...(plan.budget?.items?.map((i) => i.label) ?? []),
      ]
        .filter(Boolean)
        .join(' '),
    )
      ? 'en'
      : 'zh',
  );
  const flightItem = buildRollingGoFlightBudgetItem(flightSnapshot, {
    headcount: input.headcount,
    regionKind: input.regionKind,
    locale,
  });

  const flightIdx = items.findIndex(isFlightBudgetItem);
  if (flightIdx >= 0) {
    items[flightIdx] = flightItem;
  } else if (items.length) {
    items.unshift(flightItem);
  }

  const transportLines = plan.transport.lines.filter(
    (line) => !isRollingGoFlightSampleLine(line),
  );

  const flightOffers = resolveDisplayFlightOffers(tierQuote)?.map(
    (offer, index) =>
      index === 0 && plan.transport.flightOffers?.[0]?.recommendationReason
        ? {
            ...offer,
            recommendationReason:
              plan.transport.flightOffers[0].recommendationReason,
          }
        : offer,
  );

  return {
    ...plan,
    transport: {
      ...plan.transport,
      lines: transportLines,
      flightOffers,
    },
    ...(items.length
      ? {
          budget: {
            title: plan.budget!.title,
            items,
          },
        }
      : {}),
  };
}

function resolveDisplayFlightOffers(
  tierQuote: TravelGuideFlightTierQuote,
): TravelGuideFlightOffer[] | undefined {
  const annotated = annotateFlightOffersWithCabin(
    tierQuote.flightOffers,
    tierQuote.cabinLabel,
  );
  if (annotated?.length) return annotated;

  if (
    tierQuote.minPricePerAdult > 0 &&
    tierQuote.fromCityCode &&
    tierQuote.toCityCode
  ) {
    return [
      {
        pricePerAdult: tierQuote.minPricePerAdult,
        currency: tierQuote.currency,
        cabinLabel: tierQuote.cabinLabel,
        outbound: {
          route: `${tierQuote.fromCityCode}→${tierQuote.toCityCode}`,
          stopsLabel: tierQuote.cabinLabel,
        },
      },
    ];
  }

  return undefined;
}

function annotateFlightOffersWithCabin(
  offers: TravelGuideFlightOffer[] | undefined,
  cabinLabel?: string,
): TravelGuideFlightOffer[] | undefined {
  if (!offers?.length || !cabinLabel) return offers;
  return offers.map((offer) => ({
    ...offer,
    cabinLabel: offer.cabinLabel ?? cabinLabel,
  }));
}
