import {
  Injectable,
  Inject,
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
import { ActivityService } from '../activity/activity.service';
import {
  ACTIVITY_LOOKUP_PORT,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
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
import {
  ALL_ARTIST_PERFORMANCE_SEED,
  ALL_FESTIVAL_SESSION_SEED_COMBINED,
  ARTIST_PERFORMANCE_SEED,
  STORM_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
} from './itinerary.seed';
import {
  hasItineraryCatalogSeed,
  resolveItineraryCatalogSeed,
  resolveLineupDjs,
} from './domain/itinerary-catalog.util';
import { ItineraryCacheService } from './itinerary-cache.service';
import { LineupArtistAvatarService } from './lineup-artist-avatar.service';
import {
  detectPerformanceConflicts,
  type ItineraryConflict,
  type PerformanceSlot,
} from './domain/itinerary-conflict.util';

export interface ItineraryDjDto {
  id: string;
  name: string;
  genre: string;
  genreLabel: string;
  stage: string;
  popularity: number;
  avatarSeed: string;
  genreColor: string;
}

export interface ArtistPerformanceHit {
  activityLegacyId: number;
  activityName: string;
  artistName: string;
  dateLabel: string;
  stageLabel: string;
  startTime: string;
  endTime: string;
  genreLabel: string;
}

export interface CatalogLineupArtistDto {
  id: string;
  name: string;
  genreLabel: string;
  activityCount: number;
  thumbnail?: string;
}

export interface ItineraryScheduleDto {
  activityLegacyId: number;
  eventMeta: string;
  sessions: Array<{
    dateKey: string;
    label: string;
    bannerDateLabel: string;
  }>;
  djs: ItineraryDjDto[];
  performances: Array<{
    artistId: string;
    artistName: string;
    dateKey: string;
    dateLabel: string;
    genre: string;
    genreLabel: string;
    stage: string;
    stageLabel: string;
    startTime: string;
    endTime: string;
    startMinutes: number;
    endMinutes: number;
    popularity: number;
    avatarSeed: string;
    genreColor: string;
  }>;
  conflicts: ItineraryConflict[];
  /** False when only lineup is published without official performance slots. */
  schedulePublished: boolean;
}

const DISCOGS_STYLE_ACTIVITY_LEGACY_IDS = new Set([
  STORM_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
  ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
  ITINERARY_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID,
]);

@Injectable()
export class ItineraryScheduleService implements OnModuleInit {
  constructor(
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
    @InjectModel(FestivalSession.name)
    private readonly sessionModel: Model<FestivalSessionDocument>,
    private readonly activityService: ActivityService,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly cache: ItineraryCacheService,
    private readonly djService: DjService,
    private readonly lineupArtistAvatarService: LineupArtistAvatarService,
  ) {}

  async onModuleInit() {
    await this.seedItineraryCatalogData();
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

    await this.pruneStalePerformances(
      STORM_ACTIVITY_LEGACY_ID,
      ARTIST_PERFORMANCE_SEED,
    );
    await this.pruneStalePerformances(
      ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
      ALL_ARTIST_PERFORMANCE_SEED.filter(
        (p) => p.activityLegacyId === ITINERARY_EDC_THAILAND_ACTIVITY_LEGACY_ID,
      ),
    );
    await this.pruneStalePerformances(
      ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
      ALL_ARTIST_PERFORMANCE_SEED.filter(
        (p) => p.activityLegacyId === ITINERARY_EDC_KOREA_ACTIVITY_LEGACY_ID,
      ),
    );

    const activityIds = [
      ...new Set([
        ...ALL_FESTIVAL_SESSION_SEED_COMBINED.map((s) => s.activityLegacyId),
        ...ALL_ARTIST_PERFORMANCE_SEED.map((p) => p.activityLegacyId),
      ]),
    ];
    await Promise.all(
      activityIds.map((legacyId) => this.cache.invalidateSchedule(legacyId)),
    );
    await this.activityService.refreshActivityLookupCache();
  }

  private async pruneStalePerformances(
    activityLegacyId: number,
    canonical: Array<{ dateKey: string; artistId: string }>,
  ) {
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
      selectedDjIds?: string[];
    },
  ): Promise<ItineraryScheduleDto> {
    const cached = await this.cache.getScheduleCache<ItineraryScheduleDto>(
      activityLegacyId,
      options?.dateKey,
    );
    if (cached && !options?.selectedDjIds?.length) {
      return cached;
    }

    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    const sessionFilter: Record<string, unknown> = { activityLegacyId };
    const perfFilter: Record<string, unknown> = { activityLegacyId };
    if (options?.dateKey) {
      sessionFilter.dateKey = options.dateKey;
      perfFilter.dateKey = options.dateKey;
    }

    let [sessions, performances] = await Promise.all([
      this.sessionModel
        .find(sessionFilter)
        .sort({ sortOrder: 1 })
        .lean()
        .exec(),
      this.performanceModel.find(perfFilter).lean().exec(),
    ]);

    if (
      performances.length === 0 &&
      sessions.length === 0 &&
      hasItineraryCatalogSeed(activityLegacyId)
    ) {
      await this.seedItineraryCatalogData();
      [sessions, performances] = await Promise.all([
        this.sessionModel
          .find(sessionFilter)
          .sort({ sortOrder: 1 })
          .lean()
          .exec(),
        this.performanceModel.find(perfFilter).lean().exec(),
      ]);
    }

    const eventMeta = activity.name;
    const styledPerformances = await this.applyDiscogsStylesToPerformances(
      activityLegacyId,
      performances as ArtistPerformance[],
    );
    const schedulePublished = styledPerformances.length > 0;
    const djs = schedulePublished
      ? this.aggregateDjs(styledPerformances)
      : await this.applyDiscogsStylesToLineupDjs(
          activityLegacyId,
          resolveLineupDjs(activityLegacyId),
        );
    const slots = this.toPerformanceSlots(styledPerformances);
    const conflicts = options?.selectedDjIds?.length
      ? detectPerformanceConflicts(slots, options.selectedDjIds)
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
      performances: styledPerformances.map((p) => ({
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
      await this.cache.setScheduleCache(
        activityLegacyId,
        dto,
        options?.dateKey,
      );
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

    let [sessions, performances] = await Promise.all([
      this.sessionModel
        .find({ activityLegacyId })
        .sort({ sortOrder: 1 })
        .lean()
        .exec(),
      this.performanceModel.find(perfFilter).lean().exec(),
    ]);

    if (
      performances.length === 0 &&
      sessions.length === 0 &&
      hasItineraryCatalogSeed(activityLegacyId)
    ) {
      await this.seedItineraryCatalogData();
      [sessions, performances] = await Promise.all([
        this.sessionModel
          .find({ activityLegacyId })
          .sort({ sortOrder: 1 })
          .lean()
          .exec(),
        this.performanceModel.find(perfFilter).lean().exec(),
      ]);
    }

    return {
      sessions: sessions as FestivalSession[],
      performances: performances as ArtistPerformance[],
    };
  }

  detectConflicts(
    performances: ArtistPerformance[],
    selectedDjIds: string[],
  ): ItineraryConflict[] {
    return detectPerformanceConflicts(
      this.toPerformanceSlots(performances),
      selectedDjIds,
    );
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
          popularity: p.popularity,
          avatarSeed: p.avatarSeed,
          genreColor: p.genreColor,
        });
      }
    }
    return [...map.values()].sort((a, b) => b.popularity - a.popularity);
  }

  /**
   * Unique artists on announced lineups for existing activities.
   * Only `activityLegacyIds` present in the activity catalog are considered.
   */
  async listLineupArtistsForActivities(
    activityLegacyIds: number[],
  ): Promise<Array<{ artistName: string; genreLabel: string }>> {
    const requested = [
      ...new Set(activityLegacyIds.filter((id) => Number.isFinite(id))),
    ];
    if (!requested.length) {
      return [];
    }

    const activities = await this.activityLookup.findAll();
    const existingIds = new Set(
      activities.map((activity) => activity.legacyId),
    );
    const targetActivities = activities.filter((activity) =>
      requested.includes(activity.legacyId),
    );
    if (!targetActivities.length) {
      return [];
    }

    const legacyIds = targetActivities
      .map((activity) => activity.legacyId)
      .filter((id) => existingIds.has(id));
    const performances = await this.performanceModel
      .find({ activityLegacyId: { $in: legacyIds } })
      .select('activityLegacyId artistName genreLabel')
      .lean()
      .exec();

    const byName = new Map<
      string,
      { artistName: string; genreLabel: string }
    >();
    const addArtist = (artistName: string, genreLabel: string) => {
      const trimmed = artistName.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (byName.has(key)) return;
      byName.set(key, {
        artistName: trimmed,
        genreLabel: genreLabel.trim() || 'Electronic',
      });
    };

    for (const activity of targetActivities) {
      for (const artist of this.collectLineupArtistsForActivity(
        activity.legacyId,
        performances,
      )) {
        addArtist(artist.artistName, artist.genreLabel);
      }
    }

    return [...byName.values()];
  }

  /**
   * Unique lineup artists across all activities in the catalog, ranked by
   * how many activities each artist appears on.
   */
  async listCatalogLineupArtistsRanked(): Promise<CatalogLineupArtistDto[]> {
    const activities = await this.activityLookup.findAll();
    if (!activities.length) {
      return [];
    }

    const legacyIds = activities.map((activity) => activity.legacyId);
    const performances = await this.performanceModel
      .find({ activityLegacyId: { $in: legacyIds } })
      .select('activityLegacyId artistName genreLabel')
      .lean()
      .exec();

    const byArtist = new Map<
      string,
      {
        artistName: string;
        genreLabel: string;
        activityIds: Set<number>;
      }
    >();

    for (const activity of activities) {
      for (const artist of this.collectLineupArtistsForActivity(
        activity.legacyId,
        performances,
      )) {
        const key = artist.artistName.trim().toLowerCase();
        if (!key) {
          continue;
        }
        let entry = byArtist.get(key);
        if (!entry) {
          entry = {
            artistName: artist.artistName.trim(),
            genreLabel: artist.genreLabel,
            activityIds: new Set<number>(),
          };
          byArtist.set(key, entry);
        }
        entry.activityIds.add(activity.legacyId);
      }
    }

    if (!byArtist.size) {
      return [];
    }

    const artistNames = [...byArtist.values()].map((entry) => entry.artistName);
    const [catalogByLineupName, avatarUrlsByKey] = await Promise.all([
      this.djService.lookupForLineupArtists(artistNames),
      this.lineupArtistAvatarService.findAvatarUrlsByArtistNames(artistNames),
    ]);

    const ranked = [...byArtist.values()]
      .map((entry) => {
        const catalog = catalogByLineupName.get(entry.artistName);
        const genreLabel = catalog
          ? formatDiscogsStyleLabel(catalog)
          : entry.genreLabel;
        const nameKey = entry.artistName.trim().toLowerCase();
        return {
          id: this.artistIdFromName(entry.artistName),
          name: entry.artistName,
          genreLabel,
          activityCount: entry.activityIds.size,
          thumbnail: avatarUrlsByKey.get(nameKey),
        };
      })
      .filter((entry) => Boolean(entry.thumbnail?.trim()));

    return ranked.sort((a, b) => {
      if (b.activityCount !== a.activityCount) {
        return b.activityCount - a.activityCount;
      }
      return a.name.localeCompare(b.name, 'zh');
    });
  }

  /** Find activities where an artist appears on the announced lineup (not timetable-only). */
  async findArtistLineupMemberships(params: {
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
    const activities = await this.activityLookup.findAll();
    const targets =
      params.activityLegacyId != null && !Number.isNaN(params.activityLegacyId)
        ? activities.filter(
            (activity) => activity.legacyId === params.activityLegacyId,
          )
        : activities;

    if (!targets.length) {
      return [];
    }

    const legacyIds = targets.map((activity) => activity.legacyId);
    const performances = await this.performanceModel
      .find({ activityLegacyId: { $in: legacyIds } })
      .select('activityLegacyId artistName genreLabel')
      .lean()
      .exec();

    const hits: ArtistPerformanceHit[] = [];
    for (const activity of targets) {
      const artists = this.collectLineupArtistsForActivity(
        activity.legacyId,
        performances,
      );
      for (const artist of artists) {
        if (!pattern.test(artist.artistName)) {
          continue;
        }
        hits.push({
          activityLegacyId: activity.legacyId,
          activityName: activity.name?.trim() || `活动 ${activity.legacyId}`,
          artistName: artist.artistName,
          dateLabel: activity.date?.trim() || '',
          stageLabel: '官宣阵容',
          startTime: '',
          endTime: '',
          genreLabel: artist.genreLabel,
        });
      }
    }

    return hits;
  }

  private collectLineupArtistsForActivity(
    activityLegacyId: number,
    performances: Array<{
      activityLegacyId: number;
      artistName?: string;
      genreLabel?: string;
    }>,
  ): Array<{ artistName: string; genreLabel: string }> {
    const byName = new Map<
      string,
      { artistName: string; genreLabel: string }
    >();
    const addArtist = (artistName: string, genreLabel: string) => {
      const trimmed = artistName.trim();
      if (!trimmed) return;
      const key = trimmed.toLowerCase();
      if (byName.has(key)) return;
      byName.set(key, {
        artistName: trimmed,
        genreLabel: genreLabel.trim() || 'Electronic',
      });
    };

    const beforeCount = byName.size;

    for (const perf of performances) {
      if (perf.activityLegacyId !== activityLegacyId) {
        continue;
      }
      addArtist(perf.artistName ?? '', perf.genreLabel ?? '');
    }

    for (const dj of resolveLineupDjs(activityLegacyId)) {
      addArtist(dj.name, dj.genreLabel);
    }

    if (byName.size === beforeCount) {
      const { performances: seedPerformances } =
        resolveItineraryCatalogSeed(activityLegacyId);
      for (const perf of seedPerformances) {
        addArtist(perf.artistName, perf.genreLabel);
      }
    }

    return [...byName.values()];
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
    const activities = await Promise.all(
      activityIds.map((id) => this.activityService.findByLegacyId(id)),
    );
    const activityNameById = new Map(
      activities
        .filter((item): item is NonNullable<typeof item> => item != null)
        .map((item) => [
          item.legacyId,
          item.name?.trim() || `活动 ${item.legacyId}`,
        ]),
    );

    const styledByActivity = new Map<number, Map<string, string>>();
    for (const activityId of activityIds) {
      const activityPerfs = performances.filter(
        (perf) => perf.activityLegacyId === activityId,
      );
      const styled = await this.applyDiscogsStylesToPerformances(
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

  private async applyDiscogsStylesToLineupDjs(
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

  private async applyDiscogsStylesToPerformances(
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

  private resolveDiscogsGenreLabel(
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

  private toPerformanceSlots(
    performances: ArtistPerformance[],
  ): PerformanceSlot[] {
    return performances.map((p) => ({
      artistId: p.artistId,
      artistName: p.artistName,
      dateKey: p.dateKey,
      startMinutes: p.startMinutes,
      endMinutes: p.endMinutes,
      startTime: p.startTime,
      endTime: p.endTime,
      stageLabel: p.stageLabel,
    }));
  }

  private artistIdFromName(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
