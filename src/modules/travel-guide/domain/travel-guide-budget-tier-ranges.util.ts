import type {
  TravelGuideBudgetTier,
  TravelGuideBudgetTierSnapshot,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import type {
  HotelQuoteSnapshot,
  RollingGoHotelRecommendation,
  TravelQuoteEnrichment,
} from '../ports/travel-quote.types';
import { budgetTierHotelNightRanges } from './parse-activity-days.util';

const TIER_ORDER: TravelGuideBudgetTier[] = ['economy', 'standard', 'comfort'];

const STATIC_NIGHTLY_MID: Record<TravelGuideBudgetTier, number> = {
  economy: 225,
  standard: 450,
  comfort: 700,
};

function roundPrice(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return value >= 1000 ? Math.round(value / 10) * 10 : Math.round(value);
}

function parseRangeNumbers(range: string): { min: number; max: number } {
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0]!, max: nums[0]! };
  return { min: nums[0]!, max: nums[nums.length - 1]! };
}

export function findBudgetTierSnapshot(
  tier: TravelGuideBudgetTier,
  snapshots?: TravelGuideBudgetTierSnapshot[],
): TravelGuideBudgetTierSnapshot | undefined {
  return snapshots?.find((item) => item.tier === tier);
}

export function formatBudgetTierNightlyHint(
  snapshot: TravelGuideBudgetTierSnapshot,
): string {
  const { nightlyMin, nightlyMax, currency = 'CNY' } = snapshot;
  const prefix = currency === 'USD' ? '$' : '¥';
  if (nightlyMin === nightlyMax) {
    return `${prefix}${nightlyMin}`;
  }
  return `${prefix}${nightlyMin}-${nightlyMax}`;
}

export function formatBudgetTierLabel(
  tier: TravelGuideBudgetTier,
  snapshots?: TravelGuideBudgetTierSnapshot[],
  locale: 'zh' | 'en' = 'zh',
): string {
  const snapshot = findBudgetTierSnapshot(tier, snapshots);
  if (snapshot) {
    if (locale === 'en') {
      const tierName =
        tier === 'economy'
          ? 'Economy'
          : tier === 'comfort'
            ? 'Premium'
            : 'Comfort';
      return `${tierName} (${formatBudgetTierNightlyHint(snapshot)} / night)`;
    }
    const tierName =
      tier === 'economy' ? '经济' : tier === 'comfort' ? '豪华' : '舒适';
    return `${tierName}(${formatBudgetTierNightlyHint(snapshot)}/晚)`;
  }
  return legacyBudgetTierLabel(tier, locale);
}

export function budgetTierHotelNightRangesFromSnapshots(
  tier: TravelGuideBudgetTier,
  snapshots?: TravelGuideBudgetTierSnapshot[],
): { primary: string; secondary: string } {
  const snapshot = findBudgetTierSnapshot(tier, snapshots);
  if (!snapshot) return budgetTierHotelNightRanges(tier);

  const hint = formatBudgetTierNightlyHint(snapshot);
  return { primary: hint, secondary: hint };
}

function legacyBudgetTierLabel(
  tier: TravelGuideBudgetTier,
  locale: 'zh' | 'en' = 'zh',
): string {
  if (locale === 'en') {
    switch (tier) {
      case 'economy':
        return 'Economy ($21–42 / night)';
      case 'comfort':
        return 'Premium ($83+ / night)';
      default:
        return 'Comfort ($42–83 / night)';
    }
  }
  switch (tier) {
    case 'economy':
      return '经济(¥150-300/晚)';
    case 'comfort':
      return '豪华(¥600+/晚)';
    default:
      return '舒适(¥300-600/晚)';
  }
}

export function buildStaticBudgetTierSnapshots(
  currency: 'CNY' | 'USD' = 'CNY',
): TravelGuideBudgetTierSnapshot[] {
  return TIER_ORDER.map((tier) => {
    const { primary } = budgetTierHotelNightRanges(tier);
    const { min, max } = parseRangeNumbers(primary);
    return { tier, nightlyMin: min, nightlyMax: max, currency };
  });
}

/** 按查询到的 nightly 价排序后均分三档（经济/舒适/豪华）。 */
export function buildDynamicBudgetTierSnapshots(
  nightlyPrices: number[],
  currency: 'CNY' | 'USD' = 'CNY',
): TravelGuideBudgetTierSnapshot[] {
  const sorted = [...new Set(nightlyPrices.filter((price) => price > 0))].sort(
    (a, b) => a - b,
  );
  if (!sorted.length) return buildStaticBudgetTierSnapshots(currency);

  if (sorted.length >= 3) {
    const chunk = Math.ceil(sorted.length / 3);
    const buckets = [
      sorted.slice(0, chunk),
      sorted.slice(chunk, chunk * 2),
      sorted.slice(chunk * 2),
    ];
    return TIER_ORDER.map((tier, index) => {
      const bucket = buckets[index]!.length
        ? buckets[index]!
        : [sorted[Math.min(index, sorted.length - 1)]!];
      return {
        tier,
        nightlyMin: roundPrice(bucket[0]!),
        nightlyMax: roundPrice(bucket[bucket.length - 1]!),
        currency,
      };
    });
  }

  const min = sorted[0]!;
  const max = sorted[sorted.length - 1]!;
  if (min === max) {
    const spread = Math.max(
      Math.round(min * 0.12),
      currency === 'USD' ? 15 : 40,
    );
    return [
      {
        tier: 'economy',
        nightlyMin: roundPrice(Math.max(min - spread * 2, min * 0.75)),
        nightlyMax: roundPrice(min),
        currency,
      },
      {
        tier: 'standard',
        nightlyMin: roundPrice(min),
        nightlyMax: roundPrice(min + spread),
        currency,
      },
      {
        tier: 'comfort',
        nightlyMin: roundPrice(min + spread),
        nightlyMax: roundPrice(min + spread * 3),
        currency,
      },
    ];
  }

  const step = (max - min) / 3;
  return [
    {
      tier: 'economy',
      nightlyMin: roundPrice(min),
      nightlyMax: roundPrice(min + step),
      currency,
    },
    {
      tier: 'standard',
      nightlyMin: roundPrice(min + step),
      nightlyMax: roundPrice(min + step * 2),
      currency,
    },
    {
      tier: 'comfort',
      nightlyMin: roundPrice(min + step * 2),
      nightlyMax: roundPrice(max),
      currency,
    },
  ];
}

function extractPricesFromHotelRecommendations(
  recommendations?: RollingGoHotelRecommendation[],
): number[] {
  if (!recommendations?.length) return [];
  return recommendations.flatMap((rec) =>
    [rec.minPricePerNight, rec.maxPricePerNight].filter(
      (price): price is number => typeof price === 'number' && price > 0,
    ),
  );
}

function extractPricesFromHotelQuote(hotel?: HotelQuoteSnapshot): number[] {
  if (!hotel) return [];
  return [hotel.minPricePerNight, hotel.maxPricePerNight].filter(
    (price) => price > 0,
  );
}

function extractPricesFromPlanHotels(plan: TravelGuidePlan): number[] {
  const prices: number[] = [];
  for (const hotel of plan.accommodation.hotels) {
    const cny = hotel.note.match(/[¥￥]\s*([\d,]+)/)?.[1];
    if (cny) {
      const value = Number(cny.replace(/,/g, ''));
      if (value > 0) prices.push(value);
    }
    const usd = hotel.note.match(/\$\s*([\d,]+)/)?.[1];
    if (usd) {
      const value = Number(usd.replace(/,/g, ''));
      if (value > 0) prices.push(value);
    }
  }
  return prices;
}

/** 按 nightly 价从低到高重排后贴回经济/舒适/豪华，并消除档位区间重叠。 */
export function normalizeBudgetTierSnapshotsMonotonic(
  snapshots: TravelGuideBudgetTierSnapshot[],
): TravelGuideBudgetTierSnapshot[] {
  if (snapshots.length !== TIER_ORDER.length) return snapshots;

  const sorted = [...snapshots].sort(
    (a, b) =>
      a.nightlyMin - b.nightlyMin ||
      a.nightlyMax - b.nightlyMax ||
      TIER_ORDER.indexOf(a.tier) - TIER_ORDER.indexOf(b.tier),
  );

  const mapped = TIER_ORDER.map((tier, index) => ({
    ...sorted[index]!,
    tier,
    nightlyMin: roundPrice(sorted[index]!.nightlyMin),
    nightlyMax: roundPrice(sorted[index]!.nightlyMax),
  }));

  for (let i = 1; i < mapped.length; i++) {
    const prev = mapped[i - 1]!;
    const curr = mapped[i]!;
    if (
      curr.nightlyMin === prev.nightlyMin &&
      curr.nightlyMax === prev.nightlyMax
    ) {
      continue;
    }
    if (curr.nightlyMin < prev.nightlyMax) {
      curr.nightlyMin = roundPrice(prev.nightlyMax);
    }
    if (curr.nightlyMax < curr.nightlyMin) {
      const bump = Math.max(10, Math.round(curr.nightlyMin * 0.08));
      curr.nightlyMax = roundPrice(curr.nightlyMin + bump);
    }
  }

  return mapped;
}

function buildSnapshotsFromHotelByTier(
  hotelByTier: Partial<Record<TravelGuideBudgetTier, HotelQuoteSnapshot>>,
  currency: 'CNY' | 'USD',
): TravelGuideBudgetTierSnapshot[] | null {
  const snapshots: TravelGuideBudgetTierSnapshot[] = [];

  for (const tier of TIER_ORDER) {
    const quote = hotelByTier[tier];
    if (!quote || quote.minPricePerNight <= 0 || quote.maxPricePerNight <= 0) {
      return null;
    }
    snapshots.push({
      tier,
      nightlyMin: roundPrice(quote.minPricePerNight),
      nightlyMax: roundPrice(quote.maxPricePerNight),
      currency: quote.currency ?? currency,
    });
  }

  return normalizeBudgetTierSnapshotsMonotonic(snapshots);
}

export function buildBudgetTierSnapshotsFromSources(input: {
  enrichment?: TravelQuoteEnrichment | null;
  plan?: TravelGuidePlan;
  currency?: 'CNY' | 'USD';
}): TravelGuideBudgetTierSnapshot[] {
  const currency =
    input.currency ??
    input.enrichment?.hotel?.currency ??
    input.enrichment?.flight?.currency ??
    'CNY';

  if (input.enrichment?.hotelByTier) {
    const fromTiers = buildSnapshotsFromHotelByTier(
      input.enrichment.hotelByTier,
      currency,
    );
    if (fromTiers) return fromTiers;
  }

  const fromRecommendations = extractPricesFromHotelRecommendations(
    input.enrichment?.hotel?.recommendations,
  );
  if (fromRecommendations.length) {
    return buildDynamicBudgetTierSnapshots(fromRecommendations, currency);
  }

  const fromQuote = extractPricesFromHotelQuote(input.enrichment?.hotel);
  if (fromQuote.length) {
    return buildDynamicBudgetTierSnapshots(fromQuote, currency);
  }

  if (input.plan) {
    const fromPlan = extractPricesFromPlanHotels(input.plan);
    if (fromPlan.length) {
      return buildDynamicBudgetTierSnapshots(fromPlan, currency);
    }
  }

  return buildStaticBudgetTierSnapshots(currency);
}

export function resolveTierNightlyRange(
  tier: TravelGuideBudgetTier,
  snapshots?: TravelGuideBudgetTierSnapshot[],
): { min: number; max: number; currency: 'CNY' | 'USD' } {
  const snapshot = findBudgetTierSnapshot(tier, snapshots);
  if (snapshot) {
    return {
      min: snapshot.nightlyMin,
      max: snapshot.nightlyMax,
      currency: snapshot.currency ?? 'CNY',
    };
  }
  const mid = STATIC_NIGHTLY_MID[tier];
  return {
    min: Math.round(mid * 0.85),
    max: Math.round(mid * 1.15),
    currency: 'CNY',
  };
}

export function attachBudgetTierSnapshots(
  plan: TravelGuidePlan,
  enrichment?: TravelQuoteEnrichment | null,
  options?: { selectedBudgetTier?: TravelGuideBudgetTier },
): TravelGuidePlan {
  if (plan.accommodationNights <= 0) return plan;

  const snapshots = normalizeBudgetTierSnapshotsMonotonic(
    buildBudgetTierSnapshotsFromSources({
      enrichment,
      plan,
      currency: enrichment?.hotel?.currency ?? 'CNY',
    }),
  );

  const quoteTierSources = buildQuoteTierSources(
    enrichment,
    snapshots,
    options?.selectedBudgetTier,
    plan.quoteTierSources,
  );

  return {
    ...plan,
    budgetTierSnapshots: snapshots,
    ...(quoteTierSources ? { quoteTierSources } : {}),
  };
}

function buildQuoteTierSources(
  enrichment: TravelQuoteEnrichment | null | undefined,
  snapshots: TravelGuideBudgetTierSnapshot[],
  selectedBudgetTier?: TravelGuideBudgetTier,
  existing?: TravelGuidePlan['quoteTierSources'],
): TravelGuidePlan['quoteTierSources'] | undefined {
  if (
    !enrichment?.flight &&
    !enrichment?.hotel &&
    !enrichment?.hotelByTier &&
    !enrichment?.flightByTier
  ) {
    return existing;
  }

  const sources: NonNullable<TravelGuidePlan['quoteTierSources']> = {
    ...(existing ?? {}),
  };

  if (enrichment?.hotelByTier) {
    for (const tier of TIER_ORDER) {
      if (enrichment.hotelByTier[tier]) {
        sources[tier] = 'rollinggo';
      }
    }
  } else if (enrichment?.hotel && selectedBudgetTier) {
    sources[selectedBudgetTier] = 'rollinggo';
  }

  for (const snapshot of snapshots) {
    if (!sources[snapshot.tier]) {
      sources[snapshot.tier] = 'estimated';
    }
  }

  return Object.keys(sources).length ? sources : undefined;
}
