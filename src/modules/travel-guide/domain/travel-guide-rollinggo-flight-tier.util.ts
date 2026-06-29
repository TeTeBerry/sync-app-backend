import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';

/** RollingGo searchFlights cabinGrade */
export type RollingGoCabinGrade =
  | 'ECONOMY'
  | 'PREMIUM_ECONOMY'
  | 'BUSINESS'
  | 'FIRST';

const SYNC_TO_CABIN: Record<TravelGuideBudgetTier, RollingGoCabinGrade> = {
  economy: 'ECONOMY',
  standard: 'PREMIUM_ECONOMY',
  comfort: 'BUSINESS',
};

/** 某档首选舱位无结果时的降级查询顺序 */
const CABIN_FALLBACK_CHAIN: Record<
  TravelGuideBudgetTier,
  RollingGoCabinGrade[]
> = {
  economy: ['ECONOMY'],
  standard: ['PREMIUM_ECONOMY', 'ECONOMY'],
  comfort: ['BUSINESS', 'PREMIUM_ECONOMY', 'ECONOMY'],
};

export const SYNC_BUDGET_TIER_ORDER: TravelGuideBudgetTier[] = [
  'economy',
  'standard',
  'comfort',
];

export function mapSyncBudgetTierToRollingGoCabinGrade(
  tier: TravelGuideBudgetTier,
): RollingGoCabinGrade {
  return SYNC_TO_CABIN[tier];
}

export function rollingGoCabinGradesForBudgetTier(
  tier: TravelGuideBudgetTier,
): RollingGoCabinGrade[] {
  return CABIN_FALLBACK_CHAIN[tier];
}

export function rollingGoCabinGradeLabel(grade: RollingGoCabinGrade): string {
  switch (grade) {
    case 'ECONOMY':
      return '经济舱';
    case 'PREMIUM_ECONOMY':
      return '超级经济舱';
    case 'BUSINESS':
      return '公务舱';
    default:
      return '头等舱';
  }
}

export function rollingGoCabinLabelForBudgetTier(
  tier: TravelGuideBudgetTier,
): string {
  return rollingGoCabinGradeLabel(mapSyncBudgetTierToRollingGoCabinGrade(tier));
}
