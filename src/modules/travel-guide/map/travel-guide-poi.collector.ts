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
/** Align with default `TENCENT_MAP_QPS` / `TENCENT_MAP_MAX_CONCURRENT`. */
const POI_SEARCH_BATCH_SIZE = 5;

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
    const eventRegion = destinationCityFromActivityLocation(activity.location);
    const departure = await this.geoCache.resolveDeparture(
      dto.departure.trim(),
      eventRegion || undefined,
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

    const poiSearchTasks = buildPoiSearchTasks(Boolean(dto.selfDrive));
    const poiBatches = await runInBatches(
      poiSearchTasks,
      POI_SEARCH_BATCH_SIZE,
      (task) =>
        this.geoCache.searchPoisCached({
          activityLegacyId: activity.legacyId,
          venue,
          keyword: task.keyword,
          kind: task.kind,
        }),
    );

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

type PoiSearchTask = { keyword: string; kind: MapPoiKind };

function buildPoiSearchTasks(selfDrive: boolean): PoiSearchTask[] {
  const tasks: PoiSearchTask[] = HOTEL_KEYWORDS.map((keyword) => ({
    keyword,
    kind: 'hotel' as const,
  }));
  if (selfDrive) {
    tasks.push(
      ...PARKING_KEYWORDS.map((keyword) => ({
        keyword,
        kind: 'parking' as const,
      })),
    );
  }
  tasks.push(
    ...NIGHTLIFE_KEYWORDS.map((keyword) => ({
      keyword,
      kind: (/酒吧|夜店|live/i.test(keyword)
        ? 'nightlife_club'
        : 'nightlife_food') as MapPoiKind,
    })),
  );
  return tasks;
}

async function runInBatches<T, R>(
  items: T[],
  batchSize: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
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
