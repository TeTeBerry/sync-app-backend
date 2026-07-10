/** Infer festival day count from catalog date strings like `06/13-14` or `12/11-13`. */
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';

export function resolveTravelGuideBudgetTier(
  tier?: TravelGuideBudgetTier | null,
): TravelGuideBudgetTier {
  if (tier === 'economy' || tier === 'standard' || tier === 'comfort') {
    return tier;
  }
  return 'standard';
}

export function parseActivityDayCount(date?: string): number {
  const raw = date?.trim();
  if (!raw) return 2;

  const range = raw.match(/(\d{1,2})[./月](\d{1,2})\s*[-–~至]\s*(\d{1,2})/);
  if (range) {
    const start = Number(range[2]);
    const end = Number(range[3]);
    if (Number.isFinite(start) && Number.isFinite(end) && end >= start) {
      return Math.min(7, Math.max(1, end - start + 1));
    }
  }

  const single = raw.match(/(\d{1,2})[./月](\d{1,2})/g);
  if (single && single.length >= 2) {
    return Math.min(7, single.length);
  }

  return 2;
}

export function budgetTierLabel(
  tier: string,
  locale: 'zh' | 'en' = 'zh',
): string {
  if (locale === 'en') {
    switch (tier) {
      case 'economy':
        return 'Economy ($21–42 / night)';
      case 'standard':
        return 'Comfort ($42–83 / night)';
      case 'comfort':
        return 'Premium ($83+ / night)';
      default:
        return tier;
    }
  }
  switch (tier) {
    case 'economy':
      return '经济(¥150-300/晚)';
    case 'standard':
      return '舒适(¥300-600/晚)';
    case 'comfort':
      return '豪华(¥600+/晚)';
    default:
      return tier;
  }
}

/** 各档位酒店 nightly 价区间（与前端表单、fallback 文案一致） */
export function budgetTierHotelNightRanges(tier: string): {
  primary: string;
  secondary: string;
} {
  switch (tier) {
    case 'economy':
      return { primary: '¥150-250', secondary: '¥250-300' };
    case 'standard':
      return { primary: '¥300-450', secondary: '¥450-600' };
    case 'comfort':
      return { primary: '¥600-800', secondary: '¥800-1200' };
    default:
      return { primary: '¥300-600', secondary: '¥450-600' };
  }
}
