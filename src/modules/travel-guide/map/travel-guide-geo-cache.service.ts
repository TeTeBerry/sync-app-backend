import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideVenueCache,
  TravelGuideVenueCacheDocument,
} from '../../../database/schemas/travel-guide-venue-cache.schema';
import type { Activity } from '../../../database/schemas/activity.schema';
import type { MapPoiKind, RawMapPoi } from './travel-guide-map.types';
import type {
  GeocodedPlace,
  ResolvedTransport,
  ResolvedVenue,
} from './travel-guide-map.types';
import {
  findHotActivityProfile,
  matchHotHubRoute,
  matchHotInterCityRoute,
} from '@src/data/travel-guide/travel-guide-hot-path.data';
import {
  buildGenericInterCityHints,
  destinationCityFromActivityLocation,
  isInterCityByDistance,
} from './travel-guide-intercity.util';
import { isTravelGuideAbroad } from '../domain/travel-guide-international.util';
import { getHotPathFallbackPois } from '@src/data/travel-guide/travel-guide-hot-path-pois.data';
import {
  findDepartureCityAnchor,
  resolveDepartureGeocodeTargets,
} from './travel-guide-departure-suggestions.util';
import { AmapMapService } from './amap.service';
import { isVenueOutsideAmapPoiCoverage } from './travel-guide-amap-coverage.util';

const GEO_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const POI_TTL_MS = 6 * 60 * 60 * 1000;

type CacheEntry<T> = { value: T; expiresAt: number };

@Injectable()
export class TravelGuideGeoCacheService {
  private readonly logger = new Logger(TravelGuideGeoCacheService.name);
  private readonly geoMem = new Map<string, CacheEntry<GeocodedPlace>>();
  private readonly reverseMem = new Map<string, CacheEntry<string>>();
  private readonly poiMem = new Map<string, CacheEntry<RawMapPoi[]>>();

  constructor(
    private readonly map: AmapMapService,
    @InjectModel(TravelGuideVenueCache.name)
    private readonly venueCacheModel: Model<TravelGuideVenueCacheDocument>,
  ) {}

  async resolveVenue(activity: Activity): Promise<ResolvedVenue | null> {
    const legacyId = activity.legacyId;
    const hot = findHotActivityProfile(legacyId);
    if (hot) {
      return {
        venue: hot.venue,
        readableAddress: hot.readableAddress,
        source: 'hot_path',
      };
    }

    const db = await this.venueCacheModel
      .findOne({ activityLegacyId: legacyId })
      .lean();
    if (db?.venue) {
      return {
        venue: db.venue,
        readableAddress: db.readableAddress,
        source: 'database',
      };
    }

    if (isTravelGuideAbroad(activity)) {
      const lat = activity.latitude;
      const lng = activity.longitude;
      if (
        lat != null &&
        lng != null &&
        Number.isFinite(lat) &&
        Number.isFinite(lng)
      ) {
        const title =
          activity.location?.trim() || activity.name?.trim() || '会场';
        return {
          venue: {
            title,
            address: activity.location?.trim() || title,
            lat,
            lng,
          },
          readableAddress: activity.location?.trim() || title,
          source: 'database',
        };
      }
    }

    const query = activity.location?.trim() || activity.name?.trim();
    if (!query) return null;

    const city = query.split(/[·,，]/)[0]?.trim();
    const memKey = `geo:${query}`;
    const cached = this.getMem(this.geoMem, memKey);
    const venue = cached ?? (await this.map.geocode(query, city)) ?? null;
    if (!venue) return null;
    if (!cached) this.setMem(this.geoMem, memKey, venue, GEO_TTL_MS);

    const readableAddress =
      (await this.reverseGeocodeCached(venue.lat, venue.lng)) || venue.address;

    return { venue, readableAddress, source: 'api' };
  }

  async resolveDeparture(
    departureText: string,
    eventRegion?: string,
    departureCity?: string,
  ): Promise<GeocodedPlace | null> {
    const q = departureText.trim();
    if (!q) return null;

    const memKey = `geo:${q}:${departureCity?.trim() ?? ''}`;
    const cached = this.getMem(this.geoMem, memKey);
    if (cached) return cached;

    const { address, region } = resolveDepartureGeocodeTargets(
      q,
      eventRegion,
      departureCity,
    );
    let place =
      address.length > 0 ? await this.map.geocode(address, region) : null;

    const anchor = findDepartureCityAnchor(q);
    if (!place && anchor) {
      place = await this.map.geocode(anchor, anchor);
    }

    if (place) this.setMem(this.geoMem, memKey, place, GEO_TTL_MS);
    return place;
  }

  /**
   * 路线：优先 Hot Path / 库内预计算枢纽路线；否则调用 direction API。
   */
  async resolveTransport(input: {
    activityLegacyId: number;
    departureText: string;
    venue: GeocodedPlace;
    destinationCity?: string;
    selfDrive: boolean;
    departureCity?: string;
    activity?: Pick<
      import('../../../database/schemas/activity.schema').Activity,
      'name' | 'location' | 'region' | 'area'
    >;
  }): Promise<ResolvedTransport> {
    const hot = findHotActivityProfile(input.activityLegacyId);
    const abroadActivity =
      input.activity != null && isTravelGuideAbroad(input.activity);
    if (hot) {
      const interCity = matchHotInterCityRoute(hot, input.departureText);
      if (interCity) {
        const hubLegHint = abroadActivity
          ? `机场接驳（${interCity.hub.hubLabel} → 场馆）：${interCity.hub.transitHint ?? '可按地图导航或预约接驳'}`
          : `抵深后接驳（${interCity.hub.hubLabel} → 场馆）：${interCity.hub.transitHint ?? '打车或地铁前往会场'}`;
        return {
          driving: interCity.hub.driving,
          source: 'hot_path',
          interCity: true,
          hotHubLabel: `${interCity.origin.originLabel} → ${interCity.hub.hubLabel}`,
          hintLines: [...interCity.origin.primaryLegHints, hubLegHint],
        };
      }

      const hub = matchHotHubRoute(hot, input.departureText);
      if (hub) {
        return {
          driving: hub.driving,
          source: 'hot_path',
          hotHubLabel: hub.hubLabel,
          transitHint: hub.transitHint,
        };
      }
    }

    const db = await this.venueCacheModel
      .findOne({ activityLegacyId: input.activityLegacyId })
      .lean();
    if (db?.hubRoutes?.length) {
      const hub = matchDbHubRoute(db.hubRoutes, input.departureText);
      if (hub?.driving) {
        return {
          driving: hub.driving,
          source: 'database',
          hotHubLabel: hub.hubLabel,
          transitHint: hub.transitHint,
        };
      }
    }

    const departure = await this.resolveDeparture(
      input.departureText,
      input.activity
        ? destinationCityFromActivityLocation(
            input.activity.location,
            input.activity.area,
          )
        : input.destinationCity,
      input.departureCity,
    );
    if (!departure) {
      return { source: 'none' };
    }

    const from = { lat: departure.lat, lng: departure.lng };
    const to = { lat: input.venue.lat, lng: input.venue.lng };
    const crossCity = isInterCityByDistance(departure, input.venue);

    if (crossCity) {
      const destCity = input.destinationCity?.trim() || '目的地';
      const hintLines = buildGenericInterCityHints({
        departureLabel: input.departureText.trim() || departure.title,
        destinationCity: destCity,
        venueTitle: input.venue.title,
        selfDrive: input.selfDrive,
        activity: input.activity,
      });
      if (input.selfDrive) {
        const driving = (await this.map.drivingRoute(from, to)) ?? undefined;
        return {
          driving,
          source: 'api',
          interCity: true,
          hintLines,
        };
      }
      return {
        source: 'api',
        interCity: true,
        hintLines,
      };
    }

    if (input.selfDrive) {
      const driving = (await this.map.drivingRoute(from, to)) ?? undefined;
      return { driving, source: 'api' };
    }

    const [transitDetail, driving] = await Promise.all([
      this.map.transitRoute(from, to, input.destinationCity),
      this.map.drivingRoute(from, to),
    ]);

    return {
      transit: transitDetail ?? undefined,
      transitDetail: transitDetail ?? undefined,
      driving: driving ?? undefined,
      source: 'api',
    };
  }

  async searchPoisCached(input: {
    activityLegacyId: number;
    venue: GeocodedPlace;
    keyword: string;
    kind: MapPoiKind;
    /** 境外场馆：跳过高德周边搜索，仅用精选兜底 POI */
    abroad?: boolean;
  }): Promise<RawMapPoi[]> {
    const abroad =
      input.abroad ??
      isVenueOutsideAmapPoiCoverage(input.venue.lat, input.venue.lng);
    const key = `poi:${input.activityLegacyId}:${input.kind}:${input.keyword}:${abroad ? 'abroad' : 'domestic'}`;
    const cached = this.getMem(this.poiMem, key);
    if (cached) return cached;

    let pois: RawMapPoi[] = [];
    if (!abroad) {
      pois = await this.map.searchNearbyPois({
        lat: input.venue.lat,
        lng: input.venue.lng,
        keyword: input.keyword,
        kind: input.kind,
        radiusM: input.kind === 'hotel' ? 3000 : 1000,
        pageSize: 15,
      });
    }
    if (!pois.length) {
      pois = getHotPathFallbackPois(
        input.activityLegacyId,
        input.kind,
        input.keyword,
      );
      if (pois.length) {
        this.logger.warn(
          `POI fallback for activity ${input.activityLegacyId} kind=${input.kind} keyword="${input.keyword}"${abroad ? ' (abroad venue)' : ''}`,
        );
      }
    }
    if (pois.length) this.setMem(this.poiMem, key, pois, POI_TTL_MS);
    return pois;
  }

  private async reverseGeocodeCached(
    lat: number,
    lng: number,
  ): Promise<string | null> {
    const key = `rev:${lat.toFixed(5)},${lng.toFixed(5)}`;
    const cached = this.getMem(this.reverseMem, key);
    if (cached) return cached;

    const address = await this.map.reverseGeocode(lat, lng);
    if (address) this.setMem(this.reverseMem, key, address, GEO_TTL_MS);
    return address;
  }

  private getMem<T>(map: Map<string, CacheEntry<T>>, key: string): T | null {
    const entry = map.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiresAt) {
      map.delete(key);
      return null;
    }
    return entry.value;
  }

  private setMem<T>(
    map: Map<string, CacheEntry<T>>,
    key: string,
    value: T,
    ttlMs: number,
  ): void {
    map.set(key, { value, expiresAt: Date.now() + ttlMs });
  }
}

function matchDbHubRoute(
  hubs: TravelGuideVenueCache['hubRoutes'],
  departureText: string,
): TravelGuideVenueCache['hubRoutes'][number] | undefined {
  const q = departureText.trim().toLowerCase();
  if (!q) return undefined;

  for (const hub of hubs) {
    if (hub.hubLabel.toLowerCase().includes(q)) return hub;
    if (hub.departureAliases?.some((a) => q.includes(a.toLowerCase()))) {
      return hub;
    }
  }
  return undefined;
}
