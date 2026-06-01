import { Injectable, Logger } from '@nestjs/common';
import type { Activity } from '../../../database/schemas/activity.schema';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { TravelGuideGeoCacheService } from './travel-guide-geo-cache.service';
import { getAllHotPathFallbackPois } from './travel-guide-hot-path-pois.data';
import { destinationCityFromActivityLocation } from './travel-guide-intercity.util';
import type {
  MapPoiKind,
  RawMapPoi,
  TravelGuideMapContext,
} from './travel-guide-map.types';

const HOTEL_KEYWORDS = ['酒店', '宾馆'];
const PARKING_KEYWORDS = ['停车场', '停车'];
const NIGHTLIFE_KEYWORDS = [
  '酒吧',
  '夜店',
  'Livehouse',
  '夜宵',
  '烧烤',
  '便利店',
];

const DEFAULT_EVENT_END_HOUR = 23.5;

@Injectable()
export class TravelGuidePoiCollector {
  private readonly logger = new Logger(TravelGuidePoiCollector.name);

  constructor(private readonly geoCache: TravelGuideGeoCacheService) {}

  async collect(
    activity: Activity,
    dto: GenerateTravelGuideDto,
  ): Promise<TravelGuideMapContext | null> {
    const resolvedVenue = await this.geoCache.resolveVenue(activity);
    if (!resolvedVenue) {
      this.logger.warn(
        `venue resolve failed for activity ${activity.legacyId}`,
      );
      return null;
    }

    const { venue, readableAddress, source: venueSource } = resolvedVenue;
    const departure = await this.geoCache.resolveDeparture(
      dto.departure.trim(),
    );

    const transport = await this.geoCache.resolveTransport({
      activityLegacyId: activity.legacyId,
      departureText: dto.departure.trim(),
      venue,
      destinationCity: destinationCityFromActivityLocation(activity.location),
      selfDrive: Boolean(dto.selfDrive),
    });

    const transportHints: string[] = [...(transport.hintLines ?? [])];
    if (transport.hotHubLabel) {
      transportHints.push(`推荐枢纽：${transport.hotHubLabel}`);
    }
    if (transport.transitHint) {
      transportHints.push(transport.transitHint);
    }

    const poiBatches = await Promise.all([
      ...HOTEL_KEYWORDS.map((keyword) =>
        this.geoCache.searchPoisCached({
          activityLegacyId: activity.legacyId,
          venue,
          keyword,
          kind: 'hotel',
        }),
      ),
      ...(dto.selfDrive
        ? PARKING_KEYWORDS.map((keyword) =>
            this.geoCache.searchPoisCached({
              activityLegacyId: activity.legacyId,
              venue,
              keyword,
              kind: 'parking',
            }),
          )
        : []),
      ...NIGHTLIFE_KEYWORDS.map((keyword) =>
        this.geoCache.searchPoisCached({
          activityLegacyId: activity.legacyId,
          venue,
          keyword,
          kind: /酒吧|夜店|live/i.test(keyword)
            ? 'nightlife_club'
            : 'nightlife_food',
        }),
      ),
    ]);

    let pois = dedupePois(poiBatches.flat());
    if (!pois.length) {
      const fallback = getAllHotPathFallbackPois(activity.legacyId);
      if (fallback.length) {
        this.logger.warn(
          `using hot-path fallback POI set for activity ${activity.legacyId} (${venue.title})`,
        );
        pois = fallback;
      } else {
        this.logger.warn(`no POIs near venue: ${venue.title}`);
        return null;
      }
    }

    return {
      venue,
      venueReadableAddress: readableAddress,
      venueSource,
      departure: departure ?? undefined,
      drivingRoute: transport.driving,
      transitRoute: transport.transit,
      transportSource: transport.source,
      transportHints,
      interCity: transport.interCity,
      pois,
      eventEndHour: DEFAULT_EVENT_END_HOUR,
      collectedAt: new Date().toISOString(),
    };
  }
}

function dedupePois(pois: RawMapPoi[]): RawMapPoi[] {
  const seen = new Map<string, RawMapPoi>();
  for (const poi of pois) {
    const key = poi.id || `${poi.name}-${poi.lat}`;
    const existing = seen.get(key);
    if (!existing || poi.distanceM < existing.distanceM) {
      seen.set(key, poi);
    }
  }
  return [...seen.values()];
}
