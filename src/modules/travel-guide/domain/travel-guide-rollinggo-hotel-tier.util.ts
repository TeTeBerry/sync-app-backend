import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { RollingGoHotelRecord } from '../infra/rollinggo/rollinggo-mcp.types';

/** RollingGo 酒店价格档位：经济 / 舒适 / 高档 / 豪华（API 通过 starRatings 筛选） */
export type RollingGoHotelGrade = 'economy' | 'comfort' | 'upscale' | 'luxury';

/** SYNC 三档与 RollingGo 价格档位一一对应 */
const SYNC_TO_ROLLINGGO_GRADE: Record<
  TravelGuideBudgetTier,
  RollingGoHotelGrade
> = {
  economy: 'economy',
  standard: 'comfort',
  comfort: 'luxury',
};

/** RollingGo MCP filterOptions.starRatings 区间（梯度 0.5） */
const GRADE_STAR_RATINGS: Record<RollingGoHotelGrade, number[]> = {
  economy: [2.0, 3.0],
  comfort: [3.0, 4.0],
  upscale: [4.0, 4.5],
  luxury: [4.5, 5.0],
};

export function mapSyncBudgetTierToRollingGoHotelGrade(
  tier: TravelGuideBudgetTier,
): RollingGoHotelGrade {
  return SYNC_TO_ROLLINGGO_GRADE[tier];
}

export function rollingGoHotelGradeStarRatings(
  grade: RollingGoHotelGrade,
): number[] {
  return GRADE_STAR_RATINGS[grade];
}

export function rollingGoHotelGradeLabel(grade: RollingGoHotelGrade): string {
  switch (grade) {
    case 'economy':
      return '经济';
    case 'comfort':
      return '舒适';
    case 'upscale':
      return '高档';
    default:
      return '豪华';
  }
}

function inferHotelStarFromCategory(
  hotel: RollingGoHotelRecord,
): number | undefined {
  const star = hotel.starRating;
  if (star != null && star > 0) return star;
  const price = hotel.minPrice ?? 0;
  if (price <= 0) return undefined;
  if (price >= 900) return 5;
  if (price >= 650) return 4.5;
  if (price >= 450) return 4;
  if (price >= 320) return 3.5;
  if (price >= 220) return 3;
  return 2.5;
}

/** 从合并池里筛出更符合 SYNC 档位的酒店（优先星级，缺省则按价位分位）。 */
export function filterRollingGoHotelsForBudgetTier(
  hotels: RollingGoHotelRecord[],
  tier: TravelGuideBudgetTier,
): RollingGoHotelRecord[] {
  const named = hotels.filter((h) => h.name?.trim());
  if (!named.length) return [];

  const withStar = named.filter((h) => {
    const star = inferHotelStarFromCategory(h);
    if (star == null) return false;
    if (tier === 'economy') return star <= 3.0;
    if (tier === 'comfort') return star >= 4.5;
    return star >= 3.0 && star < 4.5;
  });
  if (withStar.length >= 2) return withStar;

  const prices = named
    .map((h) => h.minPrice ?? 0)
    .filter((p) => p > 0)
    .sort((a, b) => a - b);
  if (prices.length >= 3) {
    const low = prices[Math.floor(prices.length / 3)] ?? prices[0]!;
    const high =
      prices[Math.floor((prices.length * 2) / 3)] ?? prices[prices.length - 1]!;
    const byPrice = named.filter((h) => {
      const price = h.minPrice ?? 0;
      if (price <= 0) return tier === 'standard';
      if (tier === 'economy') return price <= low;
      if (tier === 'comfort') return price >= high;
      return price > low && price <= high;
    });
    if (byPrice.length >= 2) return byPrice;
  }

  return named;
}
