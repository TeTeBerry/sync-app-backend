import { Injectable, Logger } from '@nestjs/common';
import type { Activity } from '../../../database/schemas/activity.schema';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { TravelGuideGeoCacheService } from './travel-guide-geo-cache.service';
import { getAllHotPathFallbackPois } from '@src/data/travel-guide/travel-guide-hot-path-pois.data';
import { isTravelGuideAbroad } from '../domain/travel-guide-international.util';
import { filterDomesticTransportHints } from '../domain/travel-guide-departure-airport.util';
import {
  parseActivityDayCount,
  resolveTravelGuideBudgetTier,
} from '../domain/parse-activity-days.util';
import { destinationCityFromActivityLocation } from './travel-guide-intercity.util';
import {
  AFTERPARTY_SEARCH_KEYWORD,
  isAfterpartyMapPoi,
} from './travel-guide-afterparty.constants';
import { hotelSearchKeywordsForBudgetTier } from './travel-guide-hotel-keywords.util';
import type {
  MapPoiKind,
  RawMapPoi,
  TravelGuideMapContext,
} from './travel-guide-map.types';

const PARKING_KEYWORDS = ['停车场', '停车'];
const DEFAULT_EVENT_END_HOUR = 23.5;
/** Align with default `AMAP_QPS` / `AMAP_MAX_CONCURRENT`. */
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
    const destinationCity = destinationCityFromActivityLocation(
      activity.location,
    );
    const abroad = isTravelGuideAbroad(activity);
    const accommodationNights =
      dto.accommodationNights ?? parseActivityDayCount(activity.date);
    const poiSearchTasks = buildPoiSearchTasks(
      Boolean(dto.selfDrive),
      dto.budgetTier,
      abroad,
      accommodationNights,
    );

    const [departure, transport, poiBatches] = await Promise.all([
      this.geoCache.resolveDeparture(
        dto.departure.trim(),
        eventRegion || undefined,
        dto.departureCity?.trim(),
      ),
      this.geoCache.resolveTransport({
        activityLegacyId: activity.legacyId,
        departureText: dto.departure.trim(),
        venue,
        destinationCity,
        selfDrive: Boolean(dto.selfDrive),
        activity,
        departureCity: dto.departureCity?.trim(),
      }),
      runInBatches(poiSearchTasks, POI_SEARCH_BATCH_SIZE, (task) =>
        this.geoCache.searchPoisCached({
          activityLegacyId: activity.legacyId,
          venue,
          keyword: task.keyword,
          kind: task.kind,
          abroad,
        }),
      ),
    ]);

    const transportHints: string[] = abroad
      ? filterDomesticTransportHints([...(transport.hintLines ?? [])])
      : [...(transport.hintLines ?? [])];
    if (!abroad) {
      if (transport.hotHubLabel) {
        transportHints.push(`推荐枢纽：${transport.hotHubLabel}`);
      }
      if (transport.transitHint) {
        transportHints.push(transport.transitHint);
      }
    }

    let pois = dedupePois(poiBatches.flat());
    if (!pois.length) {
      const fallback = getAllHotPathFallbackPois(activity.legacyId);
      if (fallback.length) {
        this.logger.warn(
          `using hot-path fallback POI set for activity ${activity.legacyId} (${venue.title})`,
        );
        pois = fallback.filter(
          (p) =>
            p.kind !== 'hotel' &&
            (!p.kind.startsWith('nightlife') || isAfterpartyMapPoi(p)),
        );
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

function buildPoiSearchTasks(
  selfDrive: boolean,
  budgetTier: GenerateTravelGuideDto['budgetTier'],
  abroad: boolean,
  accommodationNights: number,
): PoiSearchTask[] {
  const tasks: PoiSearchTask[] = [];
  if (accommodationNights > 0) {
    const hotelKeywords = hotelSearchKeywordsForBudgetTier(
      resolveTravelGuideBudgetTier(budgetTier),
      {
        abroad,
      },
    );
    tasks.push(
      ...hotelKeywords.map((keyword) => ({
        keyword,
        kind: 'hotel' as const,
      })),
    );
  }
  if (selfDrive) {
    tasks.push(
      ...PARKING_KEYWORDS.map((keyword) => ({
        keyword,
        kind: 'parking' as const,
      })),
    );
  }
  tasks.push({
    keyword: AFTERPARTY_SEARCH_KEYWORD,
    kind: 'nightlife_food',
  });
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
