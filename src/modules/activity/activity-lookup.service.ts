import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import {
  Activity,
  ActivityDocument,
} from '../../database/schemas/activity.schema';
import { Post, PostDocument } from '../../database/schemas/post.schema';
import {
  ArtistPerformance,
  ArtistPerformanceDocument,
} from '../../database/schemas/artist-performance.schema';
import { ActivityImageService } from './activity-image.service';
import { buildActivityLookupCache } from './activity-lookup.cache';
import { isActivityLineupPublished } from './utils/activity-lineup-published.util';
import { enrichActivityLookupRecord } from '../travel-guide/domain/travel-guide-support.util';
import { enrichDevUnityAttendees } from './utils/dev-unity-attendees.util';
import type {
  ActivityListPage,
  ActivityLookupPageOptions,
  ActivityLookupRecord,
  IActivityLookupPort,
} from './ports/activity-lookup.port';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

/** Same visibility rules as public activity post feeds. */
const PUBLIC_RECRUIT_POST_MATCH = {
  activityLegacyId: { $exists: true, $type: 'number' },
  status: { $ne: 'hidden' },
  listedInFeed: { $ne: false },
} as const;

type ActivityCatalogPayload = {
  records: ActivityLookupRecord[];
};

@Injectable()
export class ActivityLookupService
  implements IActivityLookupPort, OnApplicationBootstrap
{
  private readonly logger = new Logger(ActivityLookupService.name);
  private cache = buildActivityLookupCache([]);
  private localVersion = '';
  private readonly dataKey: string;
  private readonly versionKey: string;
  private readonly ttlSec: number;

  constructor(
    @InjectModel(Activity.name) private readonly model: Model<ActivityDocument>,
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformanceDocument>,
    @InjectModel(Post.name) private readonly postModel: Model<PostDocument>,
    private readonly jsonCache: RedisMemoryJsonCacheService,
    private readonly activityImages: ActivityImageService,
    config: ConfigService,
  ) {
    this.dataKey =
      config.get<string>('catalog.activity.dataKey') ?? 'catalog:activity:v1';
    this.versionKey =
      config.get<string>('catalog.activity.versionKey') ??
      'catalog:activity:version';
    this.ttlSec = config.get<number>('catalog.activity.ttlSec') ?? 86_400;
  }

  async onApplicationBootstrap() {
    await this.refreshCache();
    this.logger.log(
      `Activity catalog cache warmed (${this.cache.all.length} records)`,
    );
  }

  async refreshCache(): Promise<void> {
    const [activities, publishedLegacyIds, recruitPostCounts] =
      await Promise.all([
        this.model.find().sort({ legacyId: 1 }).lean(),
        this.loadPublishedActivityLegacyIds(),
        this.loadRecruitPostCountsByActivity(),
      ]);
    const records = activities.map((activity) => ({
      ...activity,
      lineupPublished: isActivityLineupPublished(
        activity.legacyId,
        publishedLegacyIds.has(activity.legacyId),
      ),
      recruitPostCount: recruitPostCounts.get(activity.legacyId) ?? 0,
    })) as ActivityLookupRecord[];
    this.applyRecords(records);
    await this.jsonCache.setJson(
      this.dataKey,
      { records } satisfies ActivityCatalogPayload,
      this.ttlSec,
    );
    this.localVersion = await this.jsonCache.bumpVersion(this.versionKey);
  }

  async findAll(): Promise<ActivityLookupRecord[]> {
    await this.syncIfStale();
    const resolved = await this.activityImages.resolveRecords([
      ...this.cache.all,
    ]);
    return resolved.map((record) =>
      enrichDevUnityAttendees(enrichActivityLookupRecord(record)),
    );
  }

  async findAllBasics(): Promise<ActivityLookupRecord[]> {
    await this.syncIfStale();
    return this.cache.all.map((record) =>
      enrichDevUnityAttendees(enrichActivityLookupRecord(record)),
    );
  }

  async findByLegacyId(legacyId: number): Promise<ActivityLookupRecord | null> {
    await this.syncIfStale();
    const record = this.cache.byLegacyId.get(legacyId) ?? null;
    if (!record) {
      return null;
    }
    const [resolved] = await this.activityImages.resolveRecords([record]);
    return resolved
      ? enrichDevUnityAttendees(enrichActivityLookupRecord(resolved))
      : null;
  }

  async findByLegacyIds(
    legacyIds: number[],
  ): Promise<Map<number, ActivityLookupRecord>> {
    await this.syncIfStale();
    const records = legacyIds
      .map((legacyId) => this.cache.byLegacyId.get(legacyId))
      .filter((record): record is ActivityLookupRecord => Boolean(record));
    const resolved = await this.activityImages.resolveRecords(records);
    const map = new Map<number, ActivityLookupRecord>();
    for (const record of resolved) {
      if (record.legacyId != null) {
        map.set(
          record.legacyId,
          enrichDevUnityAttendees(enrichActivityLookupRecord(record)),
        );
      }
    }
    return map;
  }

  async findByCode(code: string): Promise<ActivityLookupRecord | null> {
    const normalized = code.toLowerCase().trim();
    if (!normalized) {
      return null;
    }
    await this.syncIfStale();
    const record = this.cache.byCode.get(normalized) ?? null;
    if (!record) {
      return null;
    }
    const [resolved] = await this.activityImages.resolveRecords([record]);
    return resolved
      ? enrichDevUnityAttendees(enrichActivityLookupRecord(resolved))
      : null;
  }

  async findPage(
    options?: ActivityLookupPageOptions,
  ): Promise<ActivityListPage> {
    await this.syncIfStale();
    const total = this.cache.all.length;
    const skip = Math.max(options?.skip ?? 0, 0);
    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_PAGE_LIMIT, 1),
      MAX_PAGE_LIMIT,
    );
    const items = (
      await this.activityImages.resolveRecords(
        this.cache.all.slice(skip, skip + limit),
      )
    ).map((record) =>
      enrichDevUnityAttendees(enrichActivityLookupRecord(record)),
    );

    return { items, total, skip, limit };
  }

  private applyRecords(records: ActivityLookupRecord[]): void {
    this.cache = buildActivityLookupCache(records);
  }

  private async loadPublishedActivityLegacyIds(): Promise<Set<number>> {
    const rows = await this.performanceModel
      .aggregate<{ _id: number }>([{ $group: { _id: '$activityLegacyId' } }])
      .exec();
    return new Set(rows.map((row) => row._id));
  }

  private async loadRecruitPostCountsByActivity(): Promise<
    Map<number, number>
  > {
    const rows = await this.postModel
      .aggregate<{
        _id: number;
        count: number;
      }>([
        { $match: PUBLIC_RECRUIT_POST_MATCH },
        { $group: { _id: '$activityLegacyId', count: { $sum: 1 } } },
      ])
      .exec();
    return new Map(rows.map((row) => [row._id, row.count]));
  }

  private async syncIfStale(): Promise<void> {
    const remoteVersion = await this.jsonCache.getVersion(this.versionKey);
    if (remoteVersion && remoteVersion === this.localVersion) {
      return;
    }

    const payload = await this.jsonCache.getJson<ActivityCatalogPayload>(
      this.dataKey,
    );
    if (payload?.records?.length) {
      this.applyRecords(payload.records);
      this.localVersion = remoteVersion ?? this.localVersion;
      return;
    }

    if (this.cache.all.length > 0 && !remoteVersion) {
      return;
    }

    await this.refreshCache();
  }
}
