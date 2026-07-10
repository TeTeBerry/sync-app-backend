import { Injectable, Logger } from '@nestjs/common';
import { AmapMapService } from '../map/amap.service';
import { TravelGuideGeoCacheService } from '../map/travel-guide-geo-cache.service';
import type { Activity } from '../../../database/schemas/activity.schema';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import type {
  GeocodedPlace,
  ResolvedVenue,
  TravelGuideMapContext,
} from '../map/travel-guide-map.types';
import { TravelGuidePoiPipeline } from '../map/travel-guide-poi.pipeline';
import type { TravelGuideRankedCandidates } from '../map/travel-guide-map.types';
import { isTravelGuideAbroad } from '../domain/travel-guide-international.util';

export interface LocationSearchResult {
  venue: ResolvedVenue | null;
  departure?: GeocodedPlace | null;
  mapCtx: TravelGuideMapContext | null;
  ranked: TravelGuideRankedCandidates | null;
}

/**
 * Location / destination context search.
 * POI pipeline remains the map-side collector; this service is the
 * provider-independent entry for origin/destination resolution + POIs.
 */
@Injectable()
export class LocationSearchService {
  private readonly logger = new Logger(LocationSearchService.name);

  constructor(
    private readonly amap: AmapMapService,
    private readonly geoCache: TravelGuideGeoCacheService,
    private readonly poiPipeline: TravelGuidePoiPipeline,
  ) {}

  async resolveAndCollect(
    activity: Activity,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
  ): Promise<LocationSearchResult> {
    if (!this.amap.enabled && !isTravelGuideAbroad(activity)) {
      return { venue: null, mapCtx: null, ranked: null };
    }

    const started = Date.now();
    try {
      const { mapCtx, ranked } = await this.poiPipeline.run(
        activity,
        dto,
        accommodationNights,
      );
      this.logger.log(
        `location search done activity=${activity.legacyId} hotels=${ranked.hotels.length} nightlife=${ranked.nightlife.length} durationMs=${Date.now() - started}`,
      );
      return {
        venue: {
          venue: mapCtx.venue,
          readableAddress: mapCtx.venueReadableAddress,
          source: mapCtx.venueSource,
        },
        departure: mapCtx.departure,
        mapCtx,
        ranked,
      };
    } catch (error) {
      this.logger.warn(
        `location search failed activity=${activity.legacyId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  async resolveVenue(activity: Activity): Promise<ResolvedVenue | null> {
    return this.geoCache.resolveVenue(activity);
  }
}
