import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AMAP_WS } from './amap.capabilities';
import { parseAmapCost } from './amap-poi-fields.util';
import { MapApiRateLimiter } from './map-api-rate-limiter';
import type { GeocodedPlace, RawMapPoi } from './travel-guide-map.types';
import type { MapPoiKind } from './travel-guide-map.types';
import type { DrivingRouteSummary } from './travel-guide-map.types';

const BASE = 'https://restapi.amap.com';

type AmapBaseResponse = {
  status: string;
  info?: string;
  infocode?: string;
};

type GeocodeResponse = AmapBaseResponse & {
  geocodes?: Array<{
    formatted_address?: string;
    location?: string;
  }>;
};

type RegeoResponse = AmapBaseResponse & {
  regeocode?: {
    formatted_address?: string;
    addressComponent?: {
      city?: string | string[];
      district?: string;
      province?: string;
      township?: string;
    };
  };
};

type InputTipsItem = {
  name?: string;
  address?: string;
  district?: string;
  location?: string;
};

type InputTipsResponse = AmapBaseResponse & {
  tips?: InputTipsItem[];
};

type PlacePoiItem = {
  id?: string;
  name?: string;
  address?: string | string[];
  location?: string;
  distance?: string;
  type?: string;
  tel?: string | string[];
  biz_ext?: {
    rating?: string | number;
    cost?: string | number | string[];
  };
};

type PlaceAroundResponse = AmapBaseResponse & {
  pois?: PlacePoiItem[];
};

type DrivingRouteResponse = AmapBaseResponse & {
  route?: {
    paths?: Array<{
      distance?: string;
      duration?: string;
    }>;
  };
};

type TransitRouteResponse = AmapBaseResponse & {
  route?: {
    transits?: Array<{
      duration?: string;
      distance?: string;
    }>;
  };
};

type WalkingRouteResponse = AmapBaseResponse & {
  route?: {
    paths?: Array<{
      distance?: string;
      duration?: string;
    }>;
  };
};

type DistanceResponse = AmapBaseResponse & {
  results?: Array<{
    distance?: string;
    duration?: string;
  }>;
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
export class AmapMapService {
  private readonly logger = new Logger(AmapMapService.name);
  readonly enabled: boolean;
  private readonly key: string;
  private readonly limiter: MapApiRateLimiter;

  constructor(private readonly config: ConfigService) {
    this.key = this.config.get<string>('amap.key') ?? '';
    this.enabled = Boolean(this.key);
    const maxConcurrent = Math.max(
      1,
      this.config.get<number>('amap.maxConcurrent') ?? 5,
    );
    const qps = Math.max(1, this.config.get<number>('amap.qps') ?? 5);
    this.limiter = new MapApiRateLimiter(maxConcurrent, qps);
  }

  async geocode(
    address: string,
    region?: string,
  ): Promise<GeocodedPlace | null> {
    if (!this.enabled) return null;
    const query = new URLSearchParams({
      address: address.trim(),
      key: this.key,
      output: 'JSON',
    });
    if (region?.trim()) query.set('city', region.trim());

    const data = await this.getJson<GeocodeResponse>(
      `${BASE}${AMAP_WS.geocode}?${query.toString()}`,
    );
    return this.parseGeocodeResult(data, address.trim());
  }

  async reverseGeocode(lat: number, lng: number): Promise<string | null> {
    const label = await this.reverseGeocodeLocationLabel(lat, lng);
    return label;
  }

  /** City / district label for post location metadata. */
  async reverseGeocodeLocationLabel(
    lat: number,
    lng: number,
  ): Promise<string | null> {
    if (!this.enabled) return null;
    const query = new URLSearchParams({
      location: toAmapLocation(lat, lng),
      key: this.key,
      output: 'JSON',
      extensions: 'base',
    });

    const data = await this.getJson<RegeoResponse>(
      `${BASE}${AMAP_WS.regeo}?${query.toString()}`,
    );
    if (!data || data.status !== '1' || !data.regeocode) return null;
    return pickRegeoLocationLabel(data.regeocode);
  }

  async getSuggestion(input: {
    keyword: string;
    region?: string;
    location?: { lat: number; lng: number };
    limit?: number;
  }): Promise<PlaceSuggestion[]> {
    if (!this.enabled) return [];
    const query = new URLSearchParams({
      keywords: input.keyword.trim(),
      key: this.key,
      output: 'JSON',
    });
    if (input.region?.trim()) query.set('city', input.region.trim());
    if (input.location) {
      query.set(
        'location',
        toAmapLocation(input.location.lat, input.location.lng),
      );
    }

    const data = await this.getJson<InputTipsResponse>(
      `${BASE}${AMAP_WS.inputTips}?${query.toString()}`,
    );
    if (!data || data.status !== '1' || !data.tips?.length) return [];

    const suggestions: PlaceSuggestion[] = [];
    for (const item of data.tips) {
      const title = item.name?.trim();
      if (!title || title === '[]') continue;
      const loc = parseAmapLocation(item.location);
      suggestions.push({
        title,
        address: item.address?.trim() || item.district?.trim() || title,
        city: item.district?.trim(),
        lat: loc?.lat,
        lng: loc?.lng,
      });
      if (suggestions.length >= (input.limit ?? 10)) break;
    }
    return suggestions;
  }

  async searchNearbyPois(input: {
    lat: number;
    lng: number;
    keyword: string;
    kind: MapPoiKind;
    radiusM?: number;
    pageSize?: number;
  }): Promise<RawMapPoi[]> {
    if (!this.enabled) return [];

    const radius = Math.min(5000, Math.max(500, input.radiusM ?? 1000));
    const query = new URLSearchParams({
      location: toAmapLocation(input.lat, input.lng),
      keywords: input.keyword,
      radius: String(radius),
      sortrule: 'distance',
      offset: String(Math.min(20, input.pageSize ?? 15)),
      page: '1',
      key: this.key,
      output: 'JSON',
    });
    if (input.kind === 'hotel') {
      query.set('types', '100000');
    }

    const data = await this.getJson<PlaceAroundResponse>(
      `${BASE}${AMAP_WS.placeAround}?${query.toString()}`,
    );
    if (!data || data.status !== '1' || !data.pois?.length) {
      if (
        data?.infocode === '10044' ||
        data?.info?.includes('USER_DAILY_QUERY_OVER_LIMIT')
      ) {
        this.logger.warn(
          `Amap place around quota exceeded for "${input.keyword}"`,
        );
      } else if (data && data.status !== '1') {
        this.logger.warn(
          `Amap place around failed (${data.infocode ?? data.status}): ${data.info ?? 'unknown'} keyword="${input.keyword}"`,
        );
      }
      return [];
    }

    return data.pois
      .map((item) => this.toRawPoi(item, input.kind, input.keyword))
      .filter((p): p is RawMapPoi => p != null);
  }

  async drivingRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingRouteSummary | null> {
    if (!this.enabled) return null;
    const query = new URLSearchParams({
      origin: toAmapLocation(from.lat, from.lng),
      destination: toAmapLocation(to.lat, to.lng),
      key: this.key,
      output: 'JSON',
    });

    const data = await this.getJson<DrivingRouteResponse>(
      `${BASE}${AMAP_WS.directionDriving}?${query.toString()}`,
    );
    const path = data?.route?.paths?.[0];
    if (!data || data.status !== '1' || !path?.distance) return null;
    return this.toDistanceSummary({
      distance: Number(path.distance),
      duration: Number(path.duration ?? 0),
    });
  }

  async transitRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
    city?: string,
  ): Promise<DrivingRouteSummary | null> {
    if (!this.enabled) return null;
    const query = new URLSearchParams({
      origin: toAmapLocation(from.lat, from.lng),
      destination: toAmapLocation(to.lat, to.lng),
      city: city?.trim() || '全国',
      key: this.key,
      output: 'JSON',
    });

    const data = await this.getJson<TransitRouteResponse>(
      `${BASE}${AMAP_WS.directionTransit}?${query.toString()}`,
    );
    const transit = data?.route?.transits?.[0];
    if (!data || data.status !== '1' || !transit) return null;
    return this.toDistanceSummary({
      distance: Number(transit.distance ?? 0),
      duration: Number(transit.duration ?? 0),
    });
  }

  async walkingRoute(
    from: { lat: number; lng: number },
    to: { lat: number; lng: number },
  ): Promise<DrivingRouteSummary | null> {
    if (!this.enabled) return null;
    const query = new URLSearchParams({
      origin: toAmapLocation(from.lat, from.lng),
      destination: toAmapLocation(to.lat, to.lng),
      key: this.key,
      output: 'JSON',
    });

    const data = await this.getJson<WalkingRouteResponse>(
      `${BASE}${AMAP_WS.directionWalking}?${query.toString()}`,
    );
    const path = data?.route?.paths?.[0];
    if (!data || data.status !== '1' || !path?.distance) return null;
    return this.toDistanceSummary({
      distance: Number(path.distance),
      duration: Number(path.duration ?? 0),
    });
  }

  async calculateDistanceToMany(
    from: { lat: number; lng: number },
    toList: Array<{ lat: number; lng: number }>,
    mode: 'driving' | 'walking' = 'driving',
  ): Promise<DistanceToTarget[]> {
    if (!this.enabled || !toList.length) return [];

    const type = mode === 'walking' ? '3' : '1';
    const query = new URLSearchParams({
      origins: toAmapLocation(from.lat, from.lng),
      destination: toList.map((t) => toAmapLocation(t.lat, t.lng)).join('|'),
      type,
      key: this.key,
      output: 'JSON',
    });

    const data = await this.getJson<DistanceResponse>(
      `${BASE}${AMAP_WS.distance}?${query.toString()}`,
    );
    if (!data || data.status !== '1' || !data.results?.length) return [];

    return data.results
      .map((el) =>
        this.toDistanceSummary({
          distance: Number(el.distance ?? 0),
          duration: Number(el.duration ?? 0),
        }),
      )
      .filter((d): d is DistanceToTarget => d != null);
  }

  private parseGeocodeResult(
    data: GeocodeResponse | null,
    fallbackAddress: string,
  ): GeocodedPlace | null {
    const geo = data?.geocodes?.[0];
    const loc = parseAmapLocation(geo?.location);
    if (!data || data.status !== '1' || !loc) {
      this.logger.warn(
        `geocode failed for "${fallbackAddress}": ${data?.info ?? 'no result'}`,
      );
      return null;
    }

    return {
      title: fallbackAddress,
      address: geo?.formatted_address?.trim() || fallbackAddress,
      lat: loc.lat,
      lng: loc.lng,
    };
  }

  private toDistanceSummary(el: {
    distance?: number;
    duration?: number;
  }): DrivingRouteSummary | null {
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
    item: PlacePoiItem,
    kind: MapPoiKind,
    keyword: string,
  ): RawMapPoi | null {
    const loc = parseAmapLocation(item.location);
    const name = item.name?.trim();
    if (!loc || !name) return null;

    const category = item.type?.trim() ?? '';
    const lateNightFriendly = isLateNightFriendly(name, category, keyword);
    const address = formatPoiAddress(item.address);

    return {
      id: item.id?.trim() || `${name}-${loc.lat}-${loc.lng}`,
      name,
      address,
      lat: loc.lat,
      lng: loc.lng,
      category,
      distanceM: Number(item.distance ?? 0),
      tel: formatPoiTel(item.tel),
      rating: normalizeRating(item.biz_ext?.rating),
      avgPrice: parseAmapCost(item.biz_ext?.cost),
      kind,
      keyword,
      lateNightFriendly,
    };
  }

  private getJson<T>(url: string): Promise<T | null> {
    if (!this.enabled) return Promise.resolve(null);
    return this.limiter.enqueue(() => this.fetchJson<T>(url));
  }

  private async fetchJson<T>(url: string): Promise<T | null> {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        this.logger.warn(`Amap HTTP ${res.status}: ${url.split('?')[0]}`);
        return null;
      }
      return (await res.json()) as T;
    } catch (error) {
      this.logger.warn(
        `Amap request failed: ${error instanceof Error ? error.message : error}`,
      );
      return null;
    }
  }
}

function toAmapLocation(lat: number, lng: number): string {
  return `${lng},${lat}`;
}

function parseAmapLocation(
  location?: string,
): { lat: number; lng: number } | null {
  if (!location?.trim()) return null;
  const [lng, lat] = location.split(',').map((v) => Number(v.trim()));
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
}

function formatPoiAddress(address?: string | string[]): string {
  if (Array.isArray(address)) return address.filter(Boolean).join('');
  return address?.trim() ?? '';
}

function formatPoiTel(tel?: string | string[]): string | undefined {
  if (Array.isArray(tel)) return tel[0]?.trim() || undefined;
  const trimmed = tel?.trim();
  return trimmed || undefined;
}

function normalizeRating(value?: string | number): number | undefined {
  const num = typeof value === 'string' ? Number(value) : value;
  if (num == null || Number.isNaN(num)) return undefined;
  if (num <= 0) return undefined;
  if (num > 5) return Math.min(5, num / 10);
  return Math.round(num * 10) / 10;
}

function isLateNightFriendly(
  name: string,
  category: string,
  keyword: string,
): boolean {
  const blob = `${name} ${category} ${keyword}`.toLowerCase();
  return /24|酒吧|夜店|club|live|夜宵|烧烤|餐吧|酒馆|whisky|威士忌/.test(blob);
}

function normalizeCityLabelForPost(value?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === '[]') return undefined;
  return trimmed.replace(/(市|省|自治区|特别行政区)$/u, '') || trimmed;
}

export function pickRegeoLocationLabel(
  regeocode: NonNullable<RegeoResponse['regeocode']>,
): string | null {
  const comp = regeocode.addressComponent;
  const rawCity = Array.isArray(comp?.city) ? comp.city[0] : comp?.city;
  const city = normalizeCityLabelForPost(rawCity);
  const district = comp?.district?.trim();
  if (city && district && district !== city) {
    return `${city}${district}`;
  }
  if (city) return city;
  const formatted = regeocode.formatted_address?.trim();
  return formatted || null;
}
