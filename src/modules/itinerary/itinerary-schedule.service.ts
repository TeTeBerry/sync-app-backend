import {
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ArtistPerformance,
  ArtistPerformanceDocument,
} from '../../database/schemas/artist-performance.schema';
import {
  FestivalSession,
  FestivalSessionDocument,
} from '../../database/schemas/festival-session.schema';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import {
  ACTIVITY_CATALOG_REFRESH_PORT,
  type IActivityCatalogRefreshPort,
} from '../activity/ports/activity-catalog-refresh.port';
import {
  resolveLineupDjs,
  buildLineupOnlyArtistPerformanceSeed,
  LINEUP_ONLY_CATALOG_ACTIVITY_LEGACY_IDS,
  isPublishedSchedulePerformance,
} from './domain/itinerary-catalog.util';
import { ItineraryCacheService } from './itinerary-cache.service';
import {
  ALL_ARTIST_PERFORMANCE_SEED,
  ALL_FESTIVAL_SESSION_SEED_COMBINED,
  ARTIST_PERFORMANCE_SEED,
  STORM_ACTIVITY_LEGACY_ID,
  ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
  ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
  ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
} from '@src/data/itinerary/itinerary.seed';
import { ItineraryConflictService } from './itinerary-conflict.service';
import { LineupConflictService } from './lineup-conflict.service';
import { ClashResolutionService } from './clash-resolution.service';
import { DiscogsGenreEnrichmentService } from './discogs-genre-enrichment.service';
import { LineupCatalogService } from './lineup-catalog.service';
import { ArtistProfileResolver } from './artist-profile-resolver.service';
import type {
  ArtistPerformanceHit,
  CatalogLineupArtistDetailDto,
  CatalogLineupArtistDto,
  ItineraryDjDto,
  ItineraryScheduleDto,
} from './itinerary-schedule.types';
import type { ActivityLookupRecord } from '../activity/ports/activity-lookup.port';
import {
  dateKeysForTomorrowlandBelgiumWeekend,
  type TomorrowlandBelgiumWeekend,
} from './domain/tomorrowland-belgium-weekend.util';

export type {
  ArtistPerformanceHit,
  CatalogLineupArtistDetailDto,
  CatalogLineupArtistDto,
  CatalogLineupArtistNextActivityDto,
  ItineraryDjDto,
  ItineraryScheduleDto,
} from './itinerary-schedule.types';

@Injectable()
export class ItineraryScheduleService implements OnModuleInit {
  constructor(
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
    @InjectModel(FestivalSession.name)
    private readonly sessionModel: Model<FestivalSessionDocument>,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    @Inject(ACTIVITY_CATALOG_REFRESH_PORT)
    private readonly catalogRefresh: IActivityCatalogRefreshPort,
    private readonly cache: ItineraryCacheService,
    private readonly conflictService: ItineraryConflictService,
    private readonly lineupConflicts: LineupConflictService,
    private readonly clashResolution: ClashResolutionService,
    private readonly discogsGenre: DiscogsGenreEnrichmentService,
    private readonly lineupCatalog: LineupCatalogService,
    private readonly artistProfileResolver: ArtistProfileResolver,
  ) {}

  async onModuleInit() {
    if (process.env.ITINERARY_AUTO_SEED === '1') {
      await this.seedItineraryCatalogData();
    }
  }

  async seedItineraryCatalogData() {
    for (const session of ALL_FESTIVAL_SESSION_SEED_COMBINED) {
      await this.sessionModel.findOneAndUpdate(
        {
          activityLegacyId: session.activityLegacyId,
          dateKey: session.dateKey,
        },
        session,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    for (const perf of ALL_ARTIST_PERFORMANCE_SEED) {
      await this.performanceModel.findOneAndUpdate(
        {
          activityLegacyId: perf.activityLegacyId,
          dateKey: perf.dateKey,
          artistId: perf.artistId,
        },
        perf,
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    }

    for (const legacyId of LINEUP_ONLY_CATALOG_ACTIVITY_LEGACY_IDS) {
      const lineupOnly = buildLineupOnlyArtistPerformanceSeed(legacyId);
      for (const perf of lineupOnly) {
        await this.performanceModel.findOneAndUpdate(
          {
            activityLegacyId: perf.activityLegacyId,
            dateKey: perf.dateKey,
            artistId: perf.artistId,
          },
          perf,
          { upsert: true, new: true, setDefaultsOnInsert: true },
        );
      }
      await this.pruneStalePerformances(legacyId, lineupOnly);
    }

    await this.pruneStalePerformances(
      STORM_ACTIVITY_LEGACY_ID,
      ARTIST_PERFORMANCE_SEED,
    );
    await this.pruneStalePerformances(
      ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
      ALL_ARTIST_PERFORMANCE_SEED.filter(
        (p) => p.activityLegacyId === ITINERARY_DEFQON1_ACTIVITY_LEGACY_ID,
      ),
    );
    await this.pruneStalePerformances(
      ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
      ALL_ARTIST_PERFORMANCE_SEED.filter(
        (p) => p.activityLegacyId === ITINERARY_ULTRA_EUROPE_ACTIVITY_LEGACY_ID,
      ),
    );
    await this.pruneStalePerformances(
      ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
      ALL_ARTIST_PERFORMANCE_SEED.filter(
        (p) =>
          p.activityLegacyId === ITINERARY_WORLD_DJ_FESTIVAL_ACTIVITY_LEGACY_ID,
      ),
    );

    const activityIds = [
      ...new Set([
        ...ALL_FESTIVAL_SESSION_SEED_COMBINED.map((s) => s.activityLegacyId),
        ...ALL_ARTIST_PERFORMANCE_SEED.map((p) => p.activityLegacyId),
        ...LINEUP_ONLY_CATALOG_ACTIVITY_LEGACY_IDS,
      ]),
    ];
    await Promise.all(
      activityIds.map((legacyId) => this.cache.invalidateSchedule(legacyId)),
    );
    // Timetable seed/upsert may change fingerprints — mark prior clash decisions for review.
    await Promise.all(
      activityIds.map(async (legacyId) => {
        const loaded =
          await this.lineupConflicts.loadClashPerformances(legacyId);
        await this.clashResolution.invalidateForScheduleChange(
          legacyId,
          loaded.scheduleVersion,
        );
      }),
    );
    await this.catalogRefresh.refreshAfterLineupCatalogChange();
  }

  private async pruneStalePerformances(
    activityLegacyId: number,
    canonical: Array<{ dateKey: string; artistId: string }>,
  ) {
    if (!canonical.length) {
      return;
    }

    await this.performanceModel.deleteMany({
      activityLegacyId,
      $nor: canonical.map((p) => ({
        dateKey: p.dateKey,
        artistId: p.artistId,
      })),
    });
  }

  async getSchedule(
    activityLegacyId: number,
    options?: {
      dateKey?: string;
      weekend?: TomorrowlandBelgiumWeekend;
      selectedDjIds?: string[];
    },
  ): Promise<ItineraryScheduleDto> {
    const cacheKey = options?.weekend
      ? `weekend:${options.weekend}`
      : options?.dateKey;
    const cached = await this.cache.getScheduleCache<ItineraryScheduleDto>(
      activityLegacyId,
      cacheKey,
    );
    if (cached && !options?.selectedDjIds?.length) {
      return cached;
    }

    const activity = await this.activityLookup.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    const sessionFilter: Record<string, unknown> = { activityLegacyId };
    const perfFilter: Record<string, unknown> = { activityLegacyId };
    const weekendDateKeys = dateKeysForTomorrowlandBelgiumWeekend(
      activityLegacyId,
      options?.weekend,
    );
    if (weekendDateKeys) {
      sessionFilter.dateKey = { $in: weekendDateKeys };
      perfFilter.dateKey = { $in: weekendDateKeys };
    } else if (options?.dateKey) {
      sessionFilter.dateKey = options.dateKey;
      perfFilter.dateKey = options.dateKey;
    }

    const [sessions, performances] = await Promise.all([
      this.sessionModel
        .find(sessionFilter)
        .sort({ sortOrder: 1 })
        .lean()
        .exec(),
      this.performanceModel.find(perfFilter).lean().exec(),
    ]);

    const eventMeta = activity.name;
    const styledPerformances =
      await this.discogsGenre.applyDiscogsStylesToPerformances(
        activityLegacyId,
        performances as ArtistPerformance[],
      );
    const publishedPerformances = styledPerformances.filter(
      isPublishedSchedulePerformance,
    );
    const schedulePublished = publishedPerformances.length > 0;
    const djs = schedulePublished
      ? this.aggregateDjs(publishedPerformances)
      : await this.resolveUnpublishedLineupDjs(
          activityLegacyId,
          styledPerformances,
        );
    const conflicts = options?.selectedDjIds?.length
      ? this.conflictService.detectConflicts(
          publishedPerformances,
          options.selectedDjIds,
        )
      : [];

    const dto: ItineraryScheduleDto = {
      activityLegacyId,
      eventMeta,
      sessions: sessions.map((s) => ({
        dateKey: s.dateKey,
        label: s.label,
        bannerDateLabel: s.bannerDateLabel,
      })),
      djs,
      performances: publishedPerformances.map((p) => ({
        artistId: p.artistId,
        artistName: p.artistName,
        dateKey: p.dateKey,
        dateLabel: p.dateLabel,
        genre: p.genre,
        genreLabel: p.genreLabel,
        stage: p.stage,
        stageLabel: p.stageLabel,
        startTime: p.startTime,
        endTime: p.endTime,
        startMinutes: p.startMinutes,
        endMinutes: p.endMinutes,
        popularity: p.popularity,
        avatarSeed: p.avatarSeed,
        genreColor: p.genreColor,
      })),
      conflicts,
      schedulePublished,
    };

    if (!options?.selectedDjIds?.length) {
      await this.cache.setScheduleCache(activityLegacyId, dto, cacheKey);
    }

    return dto;
  }

  async loadPerformances(
    activityLegacyId: number,
    dateKey?: string,
  ): Promise<{
    sessions: FestivalSession[];
    performances: ArtistPerformance[];
  }> {
    const perfFilter: Record<string, unknown> = { activityLegacyId };
    if (dateKey) perfFilter.dateKey = dateKey;

    const [sessions, performances] = await Promise.all([
      this.sessionModel
        .find({ activityLegacyId })
        .sort({ sortOrder: 1 })
        .lean()
        .exec(),
      this.performanceModel.find(perfFilter).lean().exec(),
    ]);

    return {
      sessions: sessions as FestivalSession[],
      performances: performances as ArtistPerformance[],
    };
  }

  detectConflicts(performances: ArtistPerformance[], selectedDjIds: string[]) {
    return this.conflictService.detectConflicts(performances, selectedDjIds);
  }

  listLineupArtistsForActivities(activityLegacyIds: number[]) {
    return this.lineupCatalog.listLineupArtistsForActivities(activityLegacyIds);
  }

  listCatalogLineupArtistsRanked(): Promise<CatalogLineupArtistDto[]> {
    return this.lineupCatalog.listCatalogLineupArtistsRanked();
  }

  resolveCatalogLineupArtistById(
    id: string,
    options?: { requireThumbnail?: boolean },
  ): Promise<CatalogLineupArtistDto> {
    return this.lineupCatalog.resolveCatalogLineupArtistById(id, options);
  }

  getCatalogLineupArtistDetail(
    id: string,
  ): Promise<CatalogLineupArtistDetailDto> {
    return this.artistProfileResolver.getCatalogLineupArtistDetail(id);
  }

  listActivitiesForLineupArtist(id: string): Promise<ActivityLookupRecord[]> {
    return this.lineupCatalog.listActivitiesForLineupArtist(id);
  }

  findArtistLineupMemberships(params: {
    artistName: string;
    activityLegacyId?: number;
  }): Promise<ArtistPerformanceHit[]> {
    return this.lineupCatalog.findArtistLineupMemberships(params);
  }

  async findArtistPerformances(params: {
    artistName: string;
    activityLegacyId?: number;
  }): Promise<ArtistPerformanceHit[]> {
    const keyword = params.artistName.trim();
    if (!keyword) {
      return [];
    }

    const pattern = new RegExp(
      keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      'i',
    );
    const filter: Record<string, unknown> = { artistName: pattern };
    if (
      params.activityLegacyId != null &&
      !Number.isNaN(params.activityLegacyId)
    ) {
      filter.activityLegacyId = params.activityLegacyId;
    }

    const performances = await this.performanceModel
      .find(filter)
      .sort({ activityLegacyId: 1, dateKey: 1, startMinutes: 1 })
      .lean()
      .exec();

    const activityIds = [
      ...new Set(performances.map((perf) => perf.activityLegacyId)),
    ];
    const activityMap = await this.activityLookup.findByLegacyIds(activityIds);
    const activityNameById = new Map(
      [...activityMap.values()].map((item) => [
        item.legacyId,
        item.name?.trim() || `活动 ${item.legacyId}`,
      ]),
    );

    const styledByActivity = new Map<number, Map<string, string>>();
    for (const activityId of activityIds) {
      const activityPerfs = performances.filter(
        (perf) => perf.activityLegacyId === activityId,
      );
      const styled = await this.discogsGenre.applyDiscogsStylesToPerformances(
        activityId,
        activityPerfs as ArtistPerformance[],
      );
      styledByActivity.set(
        activityId,
        new Map(styled.map((perf) => [perf.artistId, perf.genreLabel])),
      );
    }

    return performances.map((perf) => ({
      activityLegacyId: perf.activityLegacyId,
      activityName:
        activityNameById.get(perf.activityLegacyId) ??
        `活动 ${perf.activityLegacyId}`,
      artistName: perf.artistName,
      dateLabel: perf.dateLabel,
      stageLabel: perf.stageLabel,
      startTime: perf.startTime,
      endTime: perf.endTime,
      genreLabel:
        styledByActivity.get(perf.activityLegacyId)?.get(perf.artistId) ??
        perf.genreLabel,
    }));
  }

  private async resolveUnpublishedLineupDjs(
    activityLegacyId: number,
    performances: ArtistPerformance[],
  ): Promise<ItineraryDjDto[]> {
    const seedDjs = resolveLineupDjs(activityLegacyId);
    const lineupDjs =
      seedDjs.length > 0 ? seedDjs : this.aggregateDjs(performances);
    const styled = await this.discogsGenre.applyDiscogsStylesToLineupDjs(
      activityLegacyId,
      lineupDjs,
    );
    return styled.map((dj) => ({
      id: dj.id,
      name: dj.name,
      genre: dj.genre,
      genreLabel: dj.genreLabel,
      stage: '',
      stageLabel: undefined,
      popularity: dj.popularity,
      avatarSeed: dj.avatarSeed,
      genreColor: dj.genreColor,
    }));
  }

  private aggregateDjs(performances: ArtistPerformance[]): ItineraryDjDto[] {
    const map = new Map<string, ItineraryDjDto>();
    for (const p of performances) {
      const existing = map.get(p.artistId);
      if (!existing || p.popularity > existing.popularity) {
        map.set(p.artistId, {
          id: p.artistId,
          name: p.artistName,
          genre: p.genre,
          genreLabel: p.genreLabel,
          stage: p.stage,
          stageLabel: p.stageLabel,
          popularity: p.popularity,
          avatarSeed: p.avatarSeed,
          genreColor: p.genreColor,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.popularity - a.popularity);
  }
}
