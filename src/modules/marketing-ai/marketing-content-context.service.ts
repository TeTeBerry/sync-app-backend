import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ArtistPerformance,
  ArtistPerformanceDocument,
} from '../../database/schemas/artist-performance.schema';
import { DjService } from '../dj/dj.service';
import { LineupCatalogService } from '../itinerary/lineup-catalog.service';
import type { ContentSeries } from './content-series.types';
import type { MarketingFestivalLineupArtist } from './marketing-festival.types';

export type MarketingLineupContext = {
  activityLegacyId: number;
  festivalId: string;
  name: string;
  genres: string[];
  stages: string[];
  headlineArtists: MarketingFestivalLineupArtist[];
  fullLineup: MarketingFestivalLineupArtist[];
  startDate?: string;
  endDate?: string;
};

export type MarketingArtistContext = {
  name: string;
  genre: string;
  country?: string;
  biography?: string;
  topTracks: string[];
  similarArtists: string[];
  festivalAppearances: Array<{
    festivalName: string;
    activityLegacyId: number;
    genreLabel: string;
  }>;
};

@Injectable()
export class MarketingContentContextService {
  constructor(
    private readonly lineupCatalog: LineupCatalogService,
    private readonly djService: DjService,
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
  ) {}

  async enrichFestivalContext(
    festival: Record<string, unknown>,
    seriesType: ContentSeries,
  ): Promise<Record<string, unknown>> {
    const activityLegacyId = this.resolveActivityLegacyId(festival);
    if (!activityLegacyId) {
      return { ...festival, seriesType };
    }

    if (
      seriesType === 'lineup_breakdown' ||
      seriesType === 'artist_spotlight' ||
      seriesType === 'festival_intelligence'
    ) {
      const lineupContext = await this.getLineupContext(activityLegacyId, {
        id: typeof festival.id === 'string' ? festival.id : undefined,
        name: typeof festival.name === 'string' ? festival.name : undefined,
        startDate:
          typeof festival.startDate === 'string'
            ? festival.startDate
            : undefined,
        endDate:
          typeof festival.endDate === 'string' ? festival.endDate : undefined,
      });
      if (lineupContext) {
        return {
          ...festival,
          seriesType,
          ...lineupContext,
          id: lineupContext.festivalId,
        };
      }
    }

    return { ...festival, seriesType, activityLegacyId };
  }

  async getLineupContext(
    activityLegacyId: number,
    festivalMeta?: {
      id?: string;
      name?: string;
      startDate?: string;
      endDate?: string;
    },
  ): Promise<MarketingLineupContext | null> {
    const artists = await this.lineupCatalog.listLineupArtistsForActivities([
      activityLegacyId,
    ]);
    if (artists.length === 0) {
      return null;
    }

    const performances = await this.performanceModel
      .find({ activityLegacyId })
      .select('stageLabel artistName genre genreLabel')
      .lean()
      .exec();

    const stages = [
      ...new Set(
        performances
          .map((row) => row.stageLabel?.trim())
          .filter((stage): stage is string => Boolean(stage)),
      ),
    ];

    const fullLineup = artists.map((artist) => ({
      name: artist.artistName,
      genreLabel: artist.genreLabel,
    }));

    return {
      activityLegacyId,
      festivalId: festivalMeta?.id ?? String(activityLegacyId),
      name: festivalMeta?.name ?? '',
      genres: [...new Set(fullLineup.map((a) => a.genreLabel))].slice(0, 12),
      stages,
      headlineArtists: fullLineup.slice(0, 8),
      fullLineup,
      startDate: festivalMeta?.startDate,
      endDate: festivalMeta?.endDate,
    };
  }

  async buildArtistContext(
    artistName: string,
    festival: Record<string, unknown>,
  ): Promise<MarketingArtistContext> {
    const activityLegacyId = this.resolveActivityLegacyId(festival);
    const search = await this.djService.searchByName(artistName, { limit: 1 });
    const catalogItem = search.items[0];

    const memberships = await this.lineupCatalog.findArtistLineupMemberships({
      artistName,
      activityLegacyId,
    });

    const topTracks =
      catalogItem?.representativeWorks
        ?.flatMap((work) => work.tracks)
        .slice(0, 5) ?? [];

    const genre =
      catalogItem?.genres?.[0] ??
      catalogItem?.styles?.[0] ??
      memberships[0]?.genreLabel ??
      'Electronic';

    return {
      name: catalogItem?.name ?? artistName,
      genre,
      country: catalogItem?.country,
      biography: catalogItem?.profile,
      topTracks,
      similarArtists: catalogItem?.styles?.slice(0, 4) ?? [],
      festivalAppearances: memberships.map((hit) => ({
        festivalName: hit.activityName,
        activityLegacyId: hit.activityLegacyId,
        genreLabel: hit.genreLabel,
      })),
    };
  }

  async searchArtists(keyword: string, limit = 8) {
    const result = await this.djService.searchByName(keyword, { limit });
    return result.items.map((item) => ({
      name: item.name,
      genre: item.genres[0] ?? item.styles[0] ?? '',
      country: item.country,
    }));
  }

  private resolveActivityLegacyId(
    festival: Record<string, unknown>,
  ): number | undefined {
    const raw =
      festival.activityLegacyId ??
      festival.activityLegacyID ??
      festival.legacyId;
    if (typeof raw === 'number' && Number.isFinite(raw)) {
      return raw;
    }
    if (typeof raw === 'string' && raw.trim()) {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
    return undefined;
  }
}
