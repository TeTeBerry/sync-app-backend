import { Injectable } from '@nestjs/common';
import {
  formatDiscogsStyleLabel,
  mergeDiscogsStyleLabels,
} from '../dj/discogs-style-label.util';
import { DjService } from '../dj/dj.service';
import type { DjCatalogItem } from '../dj/dj.types';
import {
  expandFestivalArtistName,
  matchLineupArtistToCatalog,
  SEED_ONLY_LINEUP_ARTISTS,
} from '../dj/lineup-name-match.util';
import type { ArtistPerformance } from '../../database/schemas/artist-performance.schema';
import {
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
  STORM_ACTIVITY_LEGACY_ID,
} from '@src/data/itinerary/itinerary.seed';
import type { ItineraryDjDto } from './itinerary-schedule.types';

const DISCOGS_STYLE_ACTIVITY_LEGACY_IDS = new Set([
  STORM_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
]);

@Injectable()
export class DiscogsGenreEnrichmentService {
  constructor(private readonly djService: DjService) {}

  async applyDiscogsStylesToLineupDjs(
    activityLegacyId: number,
    djs: ItineraryDjDto[],
  ): Promise<ItineraryDjDto[]> {
    if (
      !DISCOGS_STYLE_ACTIVITY_LEGACY_IDS.has(activityLegacyId) ||
      !djs.length
    ) {
      return djs;
    }

    const lookupNames = [
      ...new Set(
        djs.flatMap((dj) => [dj.name, ...expandFestivalArtistName(dj.name)]),
      ),
    ];
    const catalogByLineupName =
      await this.djService.lookupForLineupArtists(lookupNames);
    const catalog = await this.djService.loadCatalog();

    return djs.map((dj) => ({
      ...dj,
      genreLabel: this.resolveDiscogsGenreLabel(
        dj.name,
        dj.genreLabel,
        catalogByLineupName,
        catalog,
      ),
    }));
  }

  async applyDiscogsStylesToPerformances(
    activityLegacyId: number,
    performances: ArtistPerformance[],
  ): Promise<ArtistPerformance[]> {
    if (
      !DISCOGS_STYLE_ACTIVITY_LEGACY_IDS.has(activityLegacyId) ||
      !performances.length
    ) {
      return performances;
    }

    const lookupNames = [
      ...new Set(
        performances.flatMap((perf) => [
          perf.artistName,
          ...expandFestivalArtistName(perf.artistName),
        ]),
      ),
    ];
    const catalogByLineupName =
      await this.djService.lookupForLineupArtists(lookupNames);
    const catalog = await this.djService.loadCatalog();

    return performances.map((perf) => ({
      ...perf,
      genreLabel: this.resolveDiscogsGenreLabel(
        perf.artistName,
        perf.genreLabel,
        catalogByLineupName,
        catalog,
      ),
    }));
  }

  resolveDiscogsGenreLabel(
    artistName: string,
    seedGenreLabel: string,
    catalogByLineupName: Map<string, DjCatalogItem>,
    catalog: DjCatalogItem[],
  ): string {
    const trimmed = artistName.trim();
    if (trimmed === '国内艺人') {
      return '国内艺人';
    }
    if (SEED_ONLY_LINEUP_ARTISTS.has(trimmed.toUpperCase())) {
      return this.fallbackGenreLabel(seedGenreLabel);
    }

    const b2bParts = expandFestivalArtistName(trimmed);
    if (b2bParts.length > 1) {
      const partItems = b2bParts
        .map(
          (part) =>
            catalogByLineupName.get(part) ??
            matchLineupArtistToCatalog(part, catalog),
        )
        .filter((item): item is DjCatalogItem => Boolean(item));
      const merged = mergeDiscogsStyleLabels(partItems);
      if (merged !== '风格待补充') {
        return merged;
      }
    }

    const catalogItem =
      catalogByLineupName.get(trimmed) ??
      matchLineupArtistToCatalog(trimmed, catalog);
    if (!catalogItem) {
      return this.fallbackGenreLabel(seedGenreLabel);
    }

    const discogsLabel = formatDiscogsStyleLabel(catalogItem);
    if (discogsLabel === '风格待补充') {
      return this.fallbackGenreLabel(seedGenreLabel);
    }
    return discogsLabel;
  }

  private fallbackGenreLabel(seedGenreLabel: string): string {
    const trimmed = seedGenreLabel?.trim();
    if (trimmed && trimmed !== '风格待补充') {
      return trimmed;
    }
    return '风格待补充';
  }
}
