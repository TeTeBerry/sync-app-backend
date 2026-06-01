import type { PackageTierId } from './package-tier-id.type';

/** Numeric limits bundled with a tier purchase for one activity/event. */
export interface PackageTierLimits {
  /** `null` = unlimited for the event. */
  aiMatchCount: number | null;
  contactUnlockCount: number | null;
  mapDays: number;
  postPinCount: number;
  /** Pro-only: basic post exposure without pin slots. */
  basicExposure: boolean;
}

export type PackageFeatureIcon =
  | 'match'
  | 'contact'
  | 'map'
  | 'exposure'
  | 'pin';

export interface PackageFeatureDefinition {
  icon: PackageFeatureIcon;
  text: string;
  unlimited?: boolean;
}

export interface PackageTierDefinition {
  id: PackageTierId;
  name: string;
  priceYuan: number;
  priceLabel: string;
  audience: string;
  badge?: string;
  limits: PackageTierLimits;
  features: PackageFeatureDefinition[];
}

const PRO_LIMITS: PackageTierLimits = {
  aiMatchCount: 8,
  contactUnlockCount: 5,
  mapDays: 7,
  postPinCount: 0,
  basicExposure: true,
};

const PRO_PLUS_LIMITS: PackageTierLimits = {
  aiMatchCount: 15,
  contactUnlockCount: 12,
  mapDays: 15,
  postPinCount: 1,
  basicExposure: false,
};

const ULTRA_LIMITS: PackageTierLimits = {
  aiMatchCount: null,
  contactUnlockCount: null,
  mapDays: 30,
  postPinCount: 2,
  basicExposure: false,
};

export const PROFILE_PACKAGE_TIERS: PackageTierDefinition[] = [
  {
    id: 'pro',
    name: 'Pro',
    priceYuan: 6.9,
    priceLabel: '6.9',
    audience: '普通爱好者 · 偶尔组队散户',
    limits: PRO_LIMITS,
    features: [
      { icon: 'match', text: 'AI 智能匹配 · 8 次' },
      { icon: 'contact', text: '联系方式解锁 · 5 次' },
      { icon: 'map', text: '点位地图 · 7 天' },
      { icon: 'exposure', text: '组队帖基础曝光' },
    ],
  },
  {
    id: 'pro_plus',
    name: 'Pro+',
    priceYuan: 9.9,
    priceLabel: '9.9',
    audience: '组队发起人 · 高频找搭子用户',
    badge: '主推爆款',
    limits: PRO_PLUS_LIMITS,
    features: [
      { icon: 'match', text: 'AI 智能匹配 · 15 次' },
      { icon: 'contact', text: '联系方式解锁 · 12 次' },
      { icon: 'map', text: '点位地图 · 15 天' },
      { icon: 'pin', text: '帖子 24h 置顶 × 1 次' },
    ],
  },
  {
    id: 'ultra',
    name: 'Ultra',
    priceYuan: 15.9,
    priceLabel: '15.9',
    audience: '跨城团长 · 电音 KOL · 重度发烧友',
    limits: ULTRA_LIMITS,
    features: [
      { icon: 'match', text: 'AI 智能匹配 · 不限次', unlimited: true },
      { icon: 'contact', text: '联系方式解锁 · 不限次', unlimited: true },
      { icon: 'map', text: '点位地图 · 30 天（上限）' },
      { icon: 'pin', text: '帖子 24h 置顶 × 2 次' },
    ],
  },
];

const TIER_BY_ID = new Map<PackageTierId, PackageTierDefinition>(
  PROFILE_PACKAGE_TIERS.map((tier) => [tier.id, tier]),
);

export function getPackageTierDefinition(
  tierId: PackageTierId,
): PackageTierDefinition {
  const tier = TIER_BY_ID.get(tierId);
  if (!tier) {
    throw new Error(`Unknown package tier: ${tierId}`);
  }
  return tier;
}

export function listPackageTierDefinitions(): PackageTierDefinition[] {
  return PROFILE_PACKAGE_TIERS.map((tier) => ({
    ...tier,
    limits: { ...tier.limits },
  }));
}
