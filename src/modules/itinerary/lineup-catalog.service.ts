import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import {
  ArtistPerformance,
  ArtistPerformanceDocument,
} from '../../database/schemas/artist-performance.schema';
import {
  ACTIVITY_LOOKUP_PORT,
  type ActivityLookupRecord,
  type IActivityLookupPort,
} from '../activity/ports/activity-lookup.port';
import { DjService } from '../dj/dj.service';
import { getChineseAliasesForArtistName } from '../dj/dj-chinese-aliases.util';
import type { DjCatalogItem } from '../dj/dj.types';
import { compareActivityDateAsc } from '../../common/utils/activity-date.util';
import { LineupArtistAvatarService } from './lineup-artist-avatar.service';
import { artistIdFromLineupName } from './utils/lineup-artist-id.util';
import {
  collectLineupArtistsForActivity,
  compareCatalogLineupArtists,
  pickNextActivityForArtist,
} from './domain/lineup-catalog-artist.util';
import {
  resolveLineupSeedGenre,
  resolveLineupSeedGenreLabel,
} from './domain/lineup-artist-data-policy';
import type {
  ArtistPerformanceHit,
  CatalogLineupArtistDto,
  CatalogLineupArtistEntryInternal,
} from './itinerary-schedule.types';

type RankedLineupCatalogPayload = {
  items: CatalogLineupArtistDto[];
};

@Injectable()
export class LineupCatalogService implements OnApplicationBootstrap {
  private readonly logger = new Logger(LineupCatalogService.name);
  private rankedCache: CatalogLineupArtistDto[] | null = null;
  private localVersion = '';
  private readonly dataKey: string;
  private readonly versionKey: string;
  private readonly ttlSec: number;

  constructor(
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
    @Inject(ACTIVITY_LOOKUP_PORT)
    private readonly activityLookup: IActivityLookupPort,
    private readonly djService: DjService,
    private readonly lineupArtistAvatarService: LineupArtistAvatarService,
    private readonly jsonCache: RedisMemoryJsonCacheService,
    config: ConfigService,
  ) {
    this.dataKey =
      config.get<string>('catalog.lineup.dataKey') ??
      'catalog:lineup-artists:v1';
    this.versionKey =
      config.get<string>('catalog.lineup.versionKey') ??
      'catalog:lineup-artists:version';
    this.ttlSec = config.get<number>('catalog.lineup.ttlSec') ?? 86_400;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.refreshRankedCatalogCache();
    this.logger.log(
      `Lineup artist catalog cache warmed (${this.rankedCache?.length ?? 0} artists)`,
    );
  }

  async listLineupArtistsForActivities(
    activityLegacyIds: number[],
  ): Promise<Array<{ artistName: string; genreLabel: string }>> {
    const requested = [
      ...new Set(activityLegacyIds.filter((id) => Number.isFinite(id))),
    ];
    if (!requested.length) {
      return [];
    }

    const activities = await this.activityLookup.findAllBasics();
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
      .select('activityLegacyId artistName genre genreLabel')
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
      for (const artist of collectLineupArtistsForActivity(
        activity.legacyId,
        performances,
      )) {
        addArtist(artist.artistName, artist.genreLabel);
      }
    }

    return [...byName.values()];
  }

  async listCatalogLineupArtistsRanked(): Promise<CatalogLineupArtistDto[]> {
    await this.syncRankedCatalogIfStale();
    return this.rankedCache ?? [];
  }

  async refreshRankedCatalogCache(): Promise<void> {
    const ranked = await this.buildRankedCatalog();
    this.rankedCache = ranked;
    await this.jsonCache.setJson(
      this.dataKey,
      { items: ranked } satisfies RankedLineupCatalogPayload,
      this.ttlSec,
    );
    this.localVersion = await this.jsonCache.bumpVersion(this.versionKey);
  }

  async resolveCatalogLineupArtistById(
    id: string,
    options?: { requireThumbnail?: boolean },
  ): Promise<CatalogLineupArtistDto> {
    const slug = id.trim();
    if (!slug) {
      throw new NotFoundException('Artist not found');
    }

    const index = await this.buildCatalogLineupArtistIndex();
    const entry = index.entries.find(
      (item) => artistIdFromLineupName(item.artistName) === slug,
    );
    if (!entry) {
      throw new NotFoundException('Artist not found');
    }

    const dto = this.toCatalogLineupArtistDto(entry, index);
    if (options?.requireThumbnail !== false && !dto.thumbnail?.trim()) {
      throw new NotFoundException('Artist not found');
    }

    return dto;
  }

  async listActivitiesForLineupArtist(
    id: string,
  ): Promise<ActivityLookupRecord[]> {
    const artist = await this.resolveCatalogLineupArtistById(id, {
      requireThumbnail: false,
    });
    const hits = await this.findArtistLineupMemberships({
      artistName: artist.name,
    });
    if (!hits.length) {
      return [];
    }

    const legacyIds = [...new Set(hits.map((hit) => hit.activityLegacyId))];
    const recordsById = await this.activityLookup.findByLegacyIds(legacyIds);
    const records = legacyIds
      .map((legacyId) => recordsById.get(legacyId))
      .filter((record): record is ActivityLookupRecord => Boolean(record));

    return records.sort((a, b) =>
      compareActivityDateAsc(
        { date: a.date, title: a.name },
        { date: b.date, title: b.name },
      ),
    );
  }

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
    const activities = await this.activityLookup.findAllBasics();
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
      .select('activityLegacyId artistName genre genreLabel')
      .lean()
      .exec();

    const hits: ArtistPerformanceHit[] = [];
    for (const activity of targets) {
      const artists = collectLineupArtistsForActivity(
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

  private async buildRankedCatalog(): Promise<CatalogLineupArtistDto[]> {
    const index = await this.buildCatalogLineupArtistIndex();
    if (!index.entries.length) {
      return [];
    }

    const ranked = index.entries
      .map((entry) => this.toCatalogLineupArtistDto(entry, index))
      .filter((entry) => Boolean(entry.thumbnail?.trim()));

    return ranked.sort((a, b) => compareCatalogLineupArtists(a, b));
  }

  private async syncRankedCatalogIfStale(): Promise<void> {
    const remoteVersion = await this.jsonCache.getVersion(this.versionKey);
    if (
      remoteVersion &&
      remoteVersion === this.localVersion &&
      this.rankedCache
    ) {
      return;
    }

    const payload = await this.jsonCache.getJson<RankedLineupCatalogPayload>(
      this.dataKey,
    );
    if (payload?.items) {
      this.rankedCache = payload.items;
      this.localVersion = remoteVersion ?? this.localVersion;
      return;
    }

    if (this.rankedCache && !remoteVersion) {
      return;
    }

    await this.refreshRankedCatalogCache();
  }

  private async buildCatalogLineupArtistIndex(): Promise<{
    activities: ActivityLookupRecord[];
    activitiesByLegacyId: Map<number, ActivityLookupRecord>;
    entries: CatalogLineupArtistEntryInternal[];
    catalogByLineupName: Map<string, DjCatalogItem>;
    catalog: DjCatalogItem[];
    avatarUrlsByKey: Map<string, string>;
  }> {
    const activities = await this.activityLookup.findAllBasics();
    const activitiesByLegacyId = new Map(
      activities.map((activity) => [activity.legacyId, activity]),
    );

    if (!activities.length) {
      return {
        activities,
        activitiesByLegacyId,
        entries: [],
        catalogByLineupName: new Map(),
        catalog: [],
        avatarUrlsByKey: new Map(),
      };
    }

    const legacyIds = activities.map((activity) => activity.legacyId);
    const performances = await this.performanceModel
      .find({ activityLegacyId: { $in: legacyIds } })
      .select('activityLegacyId artistName genre genreLabel')
      .lean()
      .exec();

    const byArtist = new Map<string, CatalogLineupArtistEntryInternal>();

    for (const activity of activities) {
      for (const artist of collectLineupArtistsForActivity(
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
            genre: artist.genre,
            genreLabel: artist.genreLabel,
            activityIds: new Set<number>(),
          };
          byArtist.set(key, entry);
        } else if (artist.genre && !entry.genre) {
          entry.genre = artist.genre;
        }
        entry.activityIds.add(activity.legacyId);
      }
    }

    const entries = [...byArtist.values()];
    const artistNames = entries.map((entry) => entry.artistName);
    const [catalogByLineupName, catalog, avatarUrlsByKey] = entries.length
      ? await Promise.all([
          this.djService.lookupForLineupArtists(artistNames),
          this.djService.loadCatalog(),
          this.lineupArtistAvatarService.findAvatarUrlsByArtistNames(
            artistNames,
          ),
        ])
      : [new Map<string, DjCatalogItem>(), [], new Map<string, string>()];

    return {
      activities,
      activitiesByLegacyId,
      entries,
      catalogByLineupName,
      catalog,
      avatarUrlsByKey,
    };
  }

  private toCatalogLineupArtistDto(
    entry: CatalogLineupArtistEntryInternal,
    index: {
      activitiesByLegacyId: Map<number, ActivityLookupRecord>;
      catalogByLineupName: Map<string, DjCatalogItem>;
      catalog: DjCatalogItem[];
      avatarUrlsByKey: Map<string, string>;
    },
  ): CatalogLineupArtistDto {
    const seedGenreLabel = entry.genreLabel.trim() || 'Electronic';
    const genreLabel = resolveLineupSeedGenreLabel(seedGenreLabel);
    const nameKey = entry.artistName.trim().toLowerCase();
    const nextActivity = pickNextActivityForArtist(
      entry.activityIds,
      index.activitiesByLegacyId,
    );
    const genre = resolveLineupSeedGenre(entry.genre, seedGenreLabel);
    const catalogItem = index.catalogByLineupName.get(entry.artistName);
    const chineseAliases = catalogItem?.chineseAliases?.length
      ? catalogItem.chineseAliases
      : getChineseAliasesForArtistName(entry.artistName);

    return {
      id: artistIdFromLineupName(entry.artistName),
      name: entry.artistName,
      genre,
      genreLabel,
      activityCount: entry.activityIds.size,
      thumbnail: index.avatarUrlsByKey.get(nameKey),
      ...(chineseAliases.length ? { chineseAliases } : {}),
      ...(nextActivity ? { nextActivity } : {}),
    };
  }
}
