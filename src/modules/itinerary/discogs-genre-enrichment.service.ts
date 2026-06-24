import { Injectable } from '@nestjs/common';
import { resolveLineupSeedGenreLabel } from './domain/lineup-artist-data-policy';
import type { ArtistPerformance } from '../../database/schemas/artist-performance.schema';
import type { ItineraryDjDto } from './itinerary-schedule.types';

/**
 * Lineup genre display is seed-authoritative (see `lineup-artist-data-policy.ts`).
 * This service no longer merges Discogs styles into festival lineup genres.
 */
@Injectable()
export class DiscogsGenreEnrichmentService {
  applyDiscogsStylesToLineupDjs(
    _activityLegacyId: number,
    djs: ItineraryDjDto[],
  ): Promise<ItineraryDjDto[]> {
    return Promise.resolve(
      djs.map((dj) => ({
        ...dj,
        genreLabel: resolveLineupSeedGenreLabel(dj.genreLabel),
      })),
    );
  }

  applyDiscogsStylesToPerformances(
    _activityLegacyId: number,
    performances: ArtistPerformance[],
  ): Promise<ArtistPerformance[]> {
    return Promise.resolve(
      performances.map((perf) => ({
        ...perf,
        genreLabel: resolveLineupSeedGenreLabel(perf.genreLabel),
      })),
    );
  }
}
