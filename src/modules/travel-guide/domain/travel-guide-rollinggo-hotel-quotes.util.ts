import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { RollingGoHotelRecord } from '../infra/rollinggo/rollinggo-mcp.types';
import type { HotelQuoteSnapshot } from '../ports/travel-quote.types';
import { TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT } from './travel-guide-accommodation.constants';
import { budgetTierHotelNightRanges } from './parse-activity-days.util';
import { filterRollingGoHotelsForBudgetTier } from './travel-guide-rollinggo-hotel-tier.util';
import { SYNC_BUDGET_TIER_ORDER } from './travel-guide-rollinggo-flight-tier.util';
import {
  buildRollingGoHotelRecommendations,
  summarizeHotelOffers,
} from '../infra/rollinggo/rollinggo-mcp.client';

function normalizeHotelKey(hotel: RollingGoHotelRecord): string {
  return hotel.name?.trim().toLowerCase() ?? '';
}

function mergeHotelRecords(
  batches: RollingGoHotelRecord[][],
): RollingGoHotelRecord[] {
  const byKey = new Map<string, RollingGoHotelRecord>();
  for (const batch of batches) {
    for (const hotel of batch) {
      const key = normalizeHotelKey(hotel);
      if (!key) continue;
      const existing = byKey.get(key);
      if (!existing) {
        byKey.set(key, hotel);
        continue;
      }
      byKey.set(key, {
        ...existing,
        ...hotel,
        minPrice: Math.min(
          existing.minPrice ?? Number.MAX_SAFE_INTEGER,
          hotel.minPrice ?? Number.MAX_SAFE_INTEGER,
        ),
        maxPrice: Math.max(existing.maxPrice ?? 0, hotel.maxPrice ?? 0),
        starRating: Math.max(existing.starRating ?? 0, hotel.starRating ?? 0),
      });
    }
  }
  return [...byKey.values()];
}

function resolveHotelPool(
  tierHotels: RollingGoHotelRecord[],
  unionHotels: RollingGoHotelRecord[],
  tier: TravelGuideBudgetTier,
): RollingGoHotelRecord[] {
  const tierFiltered = filterRollingGoHotelsForBudgetTier(tierHotels, tier);
  if (tierFiltered.length >= 2) return tierFiltered;

  const unionFiltered = filterRollingGoHotelsForBudgetTier(unionHotels, tier);
  if (unionFiltered.length >= 2) return unionFiltered;

  return tierHotels.length ? tierHotels : unionHotels;
}

function resolveHotelCurrency(
  countryCode: string | undefined,
  regionKind: 'domestic' | 'hmt' | 'overseas',
): 'CNY' | 'USD' {
  if (countryCode === 'TH' || countryCode === 'JP' || countryCode === 'KR') {
    return 'CNY';
  }
  return regionKind === 'overseas' ? 'USD' : 'CNY';
}

function nightlyBandFromTierTemplate(tier: TravelGuideBudgetTier): {
  min: number;
  max: number;
} {
  const { primary, secondary } = budgetTierHotelNightRanges(tier);
  const parseBand = (band: string) => {
    const nums = band.match(/\d+/g)?.map(Number) ?? [];
    return {
      min: nums[0] ?? 300,
      max: nums[nums.length - 1] ?? nums[0] ?? 600,
    };
  };
  const a = parseBand(primary);
  const b = parseBand(secondary);
  return { min: a.min, max: Math.max(a.max, b.max) };
}

/** 三档分别查询后，按档位价位/星级排序并跨档去重，避免各档首推同一家酒店。 */
export function buildDiversifiedRollingGoHotelQuotesByTier(
  tierRawHotels: Partial<Record<TravelGuideBudgetTier, RollingGoHotelRecord[]>>,
  input: {
    regionKind: 'domestic' | 'hmt' | 'overseas';
    countryCode?: string;
    venueCoords?: { lat: number; lng: number };
    recommendationLimit?: number;
  },
): Partial<Record<TravelGuideBudgetTier, HotelQuoteSnapshot>> {
  const unionHotels = mergeHotelRecords(
    SYNC_BUDGET_TIER_ORDER.map((tier) => tierRawHotels[tier] ?? []),
  );
  const featuredNames = new Set<string>();
  const result: Partial<Record<TravelGuideBudgetTier, HotelQuoteSnapshot>> = {};
  const limit = input.recommendationLimit ?? 8;
  const fetchedAt = new Date().toISOString();
  const currency = resolveHotelCurrency(input.countryCode, input.regionKind);

  for (const tier of SYNC_BUDGET_TIER_ORDER) {
    const tierHotels = tierRawHotels[tier] ?? [];
    if (!tierHotels.length && !unionHotels.length) continue;

    const pool = resolveHotelPool(tierHotels, unionHotels, tier);
    const pricedPool = pool.filter((h) => h.minPrice != null && h.minPrice > 0);

    let recommendations = buildRollingGoHotelRecommendations(
      pricedPool.length ? pricedPool : pool,
      limit,
      input.venueCoords,
      { tier, excludeFeaturedNames: featuredNames },
    );

    if (!recommendations.length) {
      recommendations = buildRollingGoHotelRecommendations(
        pricedPool.length ? pricedPool : pool,
        limit,
        input.venueCoords,
        { tier },
      );
    }

    for (const rec of recommendations.slice(
      0,
      TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT,
    )) {
      featuredNames.add(rec.name.trim());
    }

    const summarySource = pricedPool.length
      ? pricedPool
      : tierHotels.length
        ? tierHotels
        : pool;
    const summary = summarizeHotelOffers(
      summarySource,
      summarySource
        .map((h) => (typeof h.price === 'string' ? h.price : ''))
        .filter(Boolean)
        .join('\n'),
    );
    if ((!summary.min || !summary.max) && !recommendations.length) {
      continue;
    }

    const templateBand = nightlyBandFromTierTemplate(tier);
    const nightlyMin = summary.min || templateBand.min;
    const nightlyMax = summary.max || templateBand.max;

    result[tier] = {
      minPricePerNight: nightlyMin,
      maxPricePerNight: nightlyMax,
      currency,
      sampleCount: summary.count,
      fetchedAt,
      source: 'rollinggo',
      ...(recommendations.length ? { recommendations } : {}),
    };
  }

  return result;
}
