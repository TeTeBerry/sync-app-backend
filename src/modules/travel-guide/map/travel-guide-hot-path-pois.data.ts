import type { MapPoiKind, RawMapPoi } from './travel-guide-map.types';
import { findHotActivityProfile } from './travel-guide-hot-path.data';

/**
 * Hot Path 兜底 POI：腾讯地图 API 失败或配额用尽（status 121）时仍可生成攻略。
 * 店名与坐标基于场馆周边真实 POI，距离为相对会场的估算值。
 */
const STORM_FALLBACK_POIS: RawMapPoi[] = [
  poi(
    'storm-p1',
    '深圳国际会展中心停车场',
    '深圳市宝安区展城路',
    22.7048,
    113.9402,
    280,
    'parking',
    '停车场',
    undefined,
    undefined,
  ),
  poi(
    'storm-p2',
    '国展地铁站停车场',
    '深圳市宝安区福海街道',
    22.6995,
    113.935,
    450,
    'parking',
    '停车',
    undefined,
    undefined,
  ),
  poi(
    'storm-n1',
    '海底捞火锅(沙井京基百纳店)',
    '深圳市宝安区',
    22.715,
    113.955,
    1600,
    'nightlife_food',
    '夜宵',
    4.6,
    120,
    true,
  ),
  poi(
    'storm-n2',
    '潮汕砂锅粥(沙井店)',
    '深圳市宝安区沙井',
    22.711,
    113.949,
    1100,
    'nightlife_food',
    '夜宵',
    4.3,
    55,
    true,
  ),
];

const EDC_CHINA_FALLBACK_POIS: RawMapPoi[] = [
  poi(
    'edc-h1',
    '阳澄湖半岛凯宾斯基酒店',
    '苏州市工业园区阳澄湖',
    31.171,
    120.748,
    900,
    'hotel',
    '酒店',
    4.6,
    680,
  ),
  poi(
    'edc-h2',
    '苏州阳澄湖畔精品酒店',
    '苏州市工业园区',
    31.165,
    120.735,
    1100,
    'hotel',
    '宾馆',
    4.2,
    480,
  ),
  poi(
    'edc-h3',
    '全季酒店(苏州阳澄湖店)',
    '苏州市工业园区',
    31.168,
    120.752,
    800,
    'hotel',
    '酒店',
    4.4,
    420,
  ),
  poi(
    'edc-p1',
    '阳澄湖半岛旅游度假区停车场',
    '苏州市工业园区',
    31.169,
    120.741,
    200,
    'parking',
    '停车场',
    undefined,
    undefined,
  ),
  poi(
    'edc-n1',
    '很久以前羊肉串(阳澄湖店)',
    '苏州市工业园区',
    31.166,
    120.746,
    1300,
    'nightlife_food',
    '夜宵',
    4.5,
    95,
    true,
  ),
  poi(
    'edc-n2',
    '海底捞火锅(阳澄湖店)',
    '苏州市工业园区',
    31.168,
    120.752,
    1400,
    'nightlife_food',
    '夜宵',
    4.6,
    110,
    true,
  ),
];

const EDC_TH_FALLBACK_POIS: RawMapPoi[] = [
  poi(
    'th-h1',
    '普吉岛希尔顿阿卡迪亚度假酒店',
    'Phuket',
    7.89,
    98.295,
    2500,
    'hotel',
    '酒店',
    4.5,
    850,
  ),
  poi(
    'th-h2',
    'Pullman Phuket Arcadia',
    'Phuket',
    7.88,
    98.288,
    2400,
    'hotel',
    '酒店',
    4.4,
    720,
  ),
  poi(
    'th-n1',
    'Bangla Road Night Market',
    'Phuket',
    7.885,
    98.305,
    3500,
    'nightlife_food',
    '夜宵',
    4.0,
    undefined,
    true,
  ),
];

const FALLBACK_BY_ACTIVITY = new Map<number, RawMapPoi[]>([
  [4, STORM_FALLBACK_POIS],
  [2, EDC_CHINA_FALLBACK_POIS],
  [5, EDC_TH_FALLBACK_POIS],
]);

function poi(
  id: string,
  name: string,
  address: string,
  lat: number,
  lng: number,
  distanceM: number,
  kind: MapPoiKind,
  keyword: string,
  rating?: number,
  avgPrice?: number,
  lateNightFriendly = false,
): RawMapPoi {
  return {
    id,
    name,
    address,
    lat,
    lng,
    category: kind === 'hotel' ? '酒店宾馆' : kind,
    distanceM,
    kind,
    keyword,
    rating,
    avgPrice,
    lateNightFriendly,
  };
}

export function getHotPathFallbackPois(
  activityLegacyId: number,
  kind?: MapPoiKind,
  keyword?: string,
): RawMapPoi[] {
  const all = FALLBACK_BY_ACTIVITY.get(activityLegacyId);
  if (!all?.length) return [];

  return all.filter((p) => {
    if (kind) {
      if (p.kind === kind) {
        // exact kind match
      } else if (kind.startsWith('nightlife')) {
        if (p.kind !== 'nightlife_food' || p.keyword !== '夜宵') return false;
      } else {
        return false;
      }
    }
    if (keyword) {
      const k = keyword.trim();
      if (k && !p.keyword.includes(k) && !k.includes(p.keyword)) {
        return false;
      }
    }
    return true;
  });
}

export function getAllHotPathFallbackPois(
  activityLegacyId: number,
): RawMapPoi[] {
  const profile = findHotActivityProfile(activityLegacyId);
  if (!profile) return [];
  return [...(FALLBACK_BY_ACTIVITY.get(activityLegacyId) ?? [])];
}
