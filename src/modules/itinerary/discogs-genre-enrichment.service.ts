import { Injectable } from '@nestjs/common';
import { DjService } from '../dj/dj.service';
import type { ArtistPerformance } from '../../database/schemas/artist-performance.schema';
import type { ItineraryDjDto } from './itinerary-schedule.types';

/**
 * Merges mapped Discogs catalog styles into festival lineup genre fields.
 * Seed genres are not used for display — see `lineup-artist-data-policy.ts`.
 */
@Injectable()
export class DiscogsGenreEnrichmentService {
  constructor(private readonly djService: DjService) {}

  async applyDiscogsStylesToLineupDjs(
    _activityLegacyId: number,
    djs: ItineraryDjDto[],
  ): Promise<ItineraryDjDto[]> {
    const genreByName =
      await this.djService.resolveLineupGenreDisplayForArtists(
        djs.map((dj) => dj.name),
      );
    return djs.map((dj) => {
      const display = genreByName.get(dj.name);
      return display ? { ...dj, ...display } : dj;
    });
  }

  async applyDiscogsStylesToPerformances(
    _activityLegacyId: number,
    performances: ArtistPerformance[],
  ): Promise<ArtistPerformance[]> {
    const genreByName =
      await this.djService.resolveLineupGenreDisplayForArtists(
        performances.map((perf) => perf.artistName),
      );
    return performances.map((perf) => {
      const display = genreByName.get(perf.artistName);
      return display
        ? {
            ...perf,
            genre: display.genre,
            genreLabel: display.genreLabel,
          }
        : perf;
    });
  }
}
