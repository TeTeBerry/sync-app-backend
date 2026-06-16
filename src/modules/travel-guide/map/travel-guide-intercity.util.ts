import type { GeocodedPlace } from './travel-guide-map.types';

/** 直线距离超过该值视为跨城，不再用出发地→场馆的市内公交规划 */
export const INTERCITY_DISTANCE_THRESHOLD_M = 80_000;

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceM(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function isInterCityByDistance(
  departure: GeocodedPlace,
  venue: GeocodedPlace,
): boolean {
  return haversineDistanceM(departure, venue) > INTERCITY_DISTANCE_THRESHOLD_M;
}

/** 从活动 location「深圳·xxx」提取目的地城市名 */
export function destinationCityFromActivityLocation(location?: string): string {
  const loc = location?.trim() ?? '';
  if (!loc) return '';
  const city = loc.split(/[·,，]/)[0]?.trim();
  return city || loc;
}

/**
 * 出发地文案是否明显属于另一城市（如「上海」去深圳活动）。
 * 仅作辅助；最终以坐标距离为准。
 */
export function departureTextImpliesOtherCity(
  departureText: string,
  destinationCity: string,
): boolean {
  const dest = destinationCity.trim();
  if (!dest) return false;

  const q = departureText.trim();
  if (!q) return false;

  if (q.includes(dest)) return false;

  const majorOrigins = [
    '上海',
    '北京',
    '广州',
    '杭州',
    '南京',
    '武汉',
    '成都',
    '重庆',
    '西安',
    '长沙',
    '厦门',
    '青岛',
    '天津',
    '苏州',
    '东莞',
    '佛山',
    '惠州',
    '珠海',
    '香港',
    '澳门',
  ];

  return majorOrigins.some((city) => city !== dest && q.includes(city));
}

export { buildGenericInterCityHints } from '../domain/travel-guide-transport.util';
