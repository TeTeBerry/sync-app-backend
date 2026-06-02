import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TENCENT_MAP_WS } from './tencent-map.capabilities';
import { TencentMapRateLimiter } from './tencent-map-rate-limiter';
import type { GeocodedPlace, RawMapPoi } from './travel-guide-map.types';
import type { MapPoiKind } from './travel-guide-map.types';
import type { DrivingRouteSummary } from './travel-guide-map.types';

const BASE = 'https://apis.map.qq.com/ws';

type TencentBaseResponse = {
  status: number;
  message?: string;
};

type GeocoderResponse = TencentBaseResponse & {
  result?: {
    title?: string;
    address?: string;
    location?: { lat?: number; lng?: number };
  };
};

type ReverseGeocoderResponse = TencentBaseResponse & {
  result?: {
    address?: string;
    formatted_addresses?: { recommend?: string; rough?: string };
    address_component?: {
      city?: string;
      district?: string;
      province?: string;
    };
  };
};

type PlaceSearchItem = {
  id?: string;
  title?: string;
  address?: string;
  category?: string;
  tel?: string;
  location?: { lat?: number; lng?: number };
  _distance?: number;
  rating?: number;
  avg_price?: number;
};

type PlaceSearchResponse = TencentBaseResponse & {
  data?: PlaceSearchItem[];
};

type SuggestionItem = {
  title?: string;
  address?: string;
  province?: string;
  city?: string;
  district?: string;
  location?: { lat?: number; lng?: number };
};

type SuggestionResponse = TencentBaseResponse & {
  data?: SuggestionItem[];
};

type DirectionResponse = TencentBaseResponse & {
  result?: {
    routes?: Array<{
      distance?: number;
      duration?: number;
    }>;
  };
};

type DistanceElement = {
  distance?: number;
  duration?: number;
};

type DistanceResponse = TencentBaseResponse & {
  result?: {
    elements?: DistanceElement[];
  };
};

export type PlaceSuggestion = {
  title: string;
  address: string;
  city?: string;
  province?: string;
  lat?: number;
  lng?: number;
};

export type DistanceToTarget = {
  distanceM: number;
  durationSec: number;
  distanceKm: number;
  durationMin: number;
};

@Injectable()
export class TencentMapService {
  private readonly logger = new Logger(TencentMapService.name);
  readonly enabled: boolean;
  private readonly key: string;
  private readonly limiter: TencentMapRateLimiter;

  constructor(private readonly config: ConfigService) {
    this.key = this.config.get<string>('tencentMap.key') ?? '';
    this.enabled = Boolean(this.key);
    const maxConcurrent = Math.max(
      1,
      this.config.get<number>('tencentMap.maxConcurrent') ?? 5,
    );
    const qps = Math.max(1, this.config.get<number>('tencentMap.qps') ?? 5);
    this.limiter = new TencentMapRateLimiter(maxConcurrent, qps);
  }

  /** 地理编码 geocoder：地址 → 坐标 */
  async geocode(
    address: string,
    region?: string,
  ): Promise<GeocodedPlace | null> {
    if (!this.enabled) return null;
    const query = new URLSearchParams({
      address: address.trim(),
      key: this.key,
    });
    if (region?.trim()) query.set('region', region.trim());

    const data = await this.getJson<GeocoderResponse>(
      `${BASE}${TENCENT_MAP_WS.geocoder}?${query.toString()}`,
    );
    return this.parseGeocoderResult(data, address.trim());
  }

  /** 逆地理编码 reverseGeocoder：坐标 → 可读地址 */
  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    if (!this.enabled) return null;
    const query = new URLSearchParams({
      location: `${lat},${lng}`,
      key: this.key,
    });

    const data = await this.getJson<ReverseGeocoderResponse>(
      `${BASE}${TENCENT_MAP_WS.geocoder}?${query.toString()}`,
    );
    if (!data || data.status !== 0 || !data.result) return null;

    return (
      data.result.formatted_addresses?.recommend?.trim() ||
      data.result.address?.trim() ||
      null
    );
  }

  /** 输入提示 getSuggestion：关键词自动补全 */
  async getSuggestion(input: {
    keyword: string;
    region?: string;
    location?: { lat: number; lng: number };
    limit?: number;
  }): Promise<PlaceSuggestion[]> {
    if (!this.enabled) return [];
    const query = new URLSearchParams({
      keyword: input.keyword.trim(),
      key: this.key,
    });
    if (input.region?.trim()) query.set('region', input.region.trim());
    if (input.location) {
      query.set('location', `${input.location.lat},${input.location.lng}`);
    }

    const data = await this.getJson<SuggestionResponse>(
      `${BASE}${TENCENT_MAP_WS.placeSuggestion}?${query.toString()}`,
    );
    if (!data || data.status !== 0 || !data.data?.length) return [];

    const suggestions: PlaceSuggestion[] = [];
    for (const item of data.data) {
      const title = item.title?.trim();
      if (!title) continue;
      suggestions.push({
        title,
        address: item.address?.trim() || title,
        city: item.city?.trim(),
        province: item.province?.trim(),
        lat: item.location?.lat,
        lng: item.location?.lng,
      });
      if (suggestions.length >= (input.limit ?? 10)) break;
    }
    return suggestions;
  }

  /** 地点搜索 search：周边 POI */
  async searchNearbyPois(input: {
    lat: number;
    lng: number;
    keyword: string;
    kind: MapPoiKind;
    radiusM?: number;
    pageSize?: number;
  }): Promise<RawMapPoi[]> {
    if (!this.enabled) return [];

    const radius = Math.min(1000, Math.max(10, input.radiusM ?? 1000));
    const boundary = `nearby(${input.lat},${input.lng},${radius},1)`;
    const query = new URLSearchParams({
      keyword: input.keyword,
      boundary,
      page_size: String(Math.min(20, input.pageSize ?? 15)),
      page_index: '1',
      orderby: '_distance',
      key: this.key,
    });

    const data = await this.getJson<PlaceSearchResponse>(
      this.buildPlaceSearchUrl(query),
    );
    if (!data || data.status !== 0 || !data.data?.length) {
      if (data?.status === 121) {
        this.logger.warn(
          `Tencent Map place search quota exceeded for "${input.keyword}"`,
        );
      } else if (data && data.status !== 0) {
        this.logger.warn(
          `Tencent Map place search failed (${data.status}): ${data.message ?? 'unknown'} keyword="${input.keyword}"`,
        );
      }
      return [];
    }

    return data.data
      .map((item) => this.toRawPoi(item, input.kind, input.keyword))
      .filter((p): p is RawMapPoi => p != null);
  }

  /** 路线规划 direction · 驾车 */
  async drivingRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingRouteSummary | null> {
    return this.directionRoute(TENCENT_MAP_WS.directionDriving, from, to);
  }

  /** 路线规划 direction · 公交 */
  async transitRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingRouteSummary | null> {
    return this.directionRoute(TENCENT_MAP_WS.directionTransit, from, to);
  }

  /** 路线规划 direction · 步行 */
  async walkingRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingRouteSummary | null> {
    return this.directionRoute(TENCENT_MAP_WS.directionWalking, from, to);
  }

  /** 距离计算 calculateDistance：单起点 → 多终点 */
  async calculateDistanceToMany(
    from: { lat: number; lng: number },
    toList: Array<{ lat: number; lng: number }>,
    mode: 'driving' | 'walking' = 'driving',
  ): Promise<DistanceToTarget[]> {
    if (!this.enabled || !toList.length) return [];

    const query = new URLSearchParams({
      mode,
      from: `${from.lat},${from.lng}`,
      to: toList.map((t) => `${t.lat},${t.lng}`).join(';'),
      key: this.key,
    });

    const data = await this.getJson<DistanceResponse>(
      `${BASE}${TENCENT_MAP_WS.distance}?${query.toString()}`,
    );
    const elements = data?.result?.elements;
    if (!data || data.status !== 0 || !elements?.length) return [];

    return elements
      .map((el) => this.toDistanceSummary(el))
      .filter((d): d is DistanceToTarget => d != null);
  }

  private async directionRoute(
    path: string,
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingRouteSummary | null> {
    if (!this.enabled) return null;

    const query = new URLSearchParams({
      from: `${from.lat},${from.lng}`,
      to: `${to.lat},${to.lng}`,
      key: this.key,
    });

    const data = await this.getJson<DirectionResponse>(
      `${BASE}${path}?${query.toString()}`,
    );
    const route = data?.result?.routes?.[0];
    if (!data || data.status !== 0 || route?.distance == null) return null;

    return this.toDistanceSummary({
      distance: route.distance,
      duration: route.duration,
    });
  }

  private parseGeocoderResult(
    data: GeocoderResponse | null,
    fallbackAddress: string,
  ): GeocodedPlace | null {
    if (!data || data.status !== 0 || !data.result?.location) {
      this.logger.warn(
        `geocode failed for "${fallbackAddress}": ${data?.message ?? 'no result'}`,
      );
      return null;
    }
    const lat = data.result.location.lat;
    const lng = data.result.location.lng;
    if (lat == null || lng == null) return null;

    return {
      title: data.result.title?.trim() || fallbackAddress,
      address: data.result.address?.trim() || fallbackAddress,
      lat,
      lng,
    };
  }

  private toDistanceSummary(el: DistanceElement): DrivingRouteSummary | null {
    if (el.distance == null || el.distance < 0) return null;
    const distanceM = el.distance;
    const durationSec = el.duration ?? 0;
    return {
      distanceM,
      durationSec,
      distanceKm: Math.round((distanceM / 1000) * 10) / 10,
      durationMin: Math.max(0, Math.round(durationSec / 60)),
    };
  }

  private toRawPoi(
    item: PlaceSearchItem,
    kind: MapPoiKind,
    keyword: string,
  ): RawMapPoi | null {
    const lat = item.location?.lat;
    const lng = item.location?.lng;
    const name = item.title?.trim();
    if (lat == null || lng == null || !name) return null;

    const category = item.category?.trim() ?? '';
    const lateNightFriendly = isLateNightFriendly(name, category, keyword);

    return {
      id: item.id?.trim() || `${name}-${lat}-${lng}`,
      name,
      address: item.address?.trim() ?? '',
      lat,
      lng,
      category,
      distanceM: item._distance ?? 0,
      tel: item.tel?.trim() || undefined,
      rating: normalizeRating(item.rating),
      avgPrice: item.avg_price,
      kind,
      keyword,
      lateNightFriendly,
    };
  }

  /** boundary 含括号，不宜整体 URL 编码（腾讯 WebService 约定） */
  private buildPlaceSearchUrl(query: URLSearchParams): string {
    const boundary = query.get('boundary');
    if (!boundary) {
      return `${BASE}${TENCENT_MAP_WS.placeSearch}?${query.toString()}`;
    }
    const parts: string[] = [];
    query.forEach((value, key) => {
      if (key === 'boundary') {
        parts.push(`${key}=${boundary}`);
      } else {
        parts.push(`${key}=${encodeURIComponent(value)}`);
      }
    });
    return `${BASE}${TENCENT_MAP_WS.placeSearch}?${parts.join('&')}`;
  }

  private getJson<T>(url: string): Promise<T | null> {
    if (!this.enabled) {
      return Promise.resolve(null);
    }
    return this.limiter.enqueue(() => this.fetchJson<T>(url));
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(
          `Tencent Map HTTP ${res.status}: ${url.split('?')[0]}`,
        );
        return null;
      }
      return (await res.json()) as T;
    } catch (error) {
      this.logger.warn(
        `Tencent Map request failed: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}

function normalizeRating(value?: number): number | undefined {
  if (value == null || Number.isNaN(value)) return undefined;
  if (value <= 0) return undefined;
  if (value > 5) return Math.min(5, value / 10);
  return Math.round(value * 10) / 10;
}

function isLateNightFriendly(
  name: string,
  category: string,
  keyword: string,
): boolean {
  const blob = `${name} ${category} ${keyword}`.toLowerCase();
  return /24|酒吧|夜店|club|live|夜宵|烧烤|餐吧|酒馆|whisky|威士忌/.test(blob);
}
