import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import { Activity } from '../../database/schemas/activity.schema';
import { ArtistPerformance } from '../../database/schemas/artist-performance.schema';
import { ActivityImageService } from './activity-image.service';
import {
  buildActivityLookupCache,
  type ActivityLookupCacheSnapshot,
} from './activity-lookup.cache';
import { isActivityLineupPublished } from './utils/activity-lineup-published.util';
import { resolveActivityStructuredDates } from '../../common/utils/activity-date.util';
import { enrichActivityLookupRecord } from '../travel-guide/domain/travel-guide-support.util';
import type {
  ActivityLookupRecord,
  ActivityListPage,
  ActivityLookupPageOptions,
} from './ports/activity-lookup.port';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

@Injectable()
export class ActivityLookupService implements OnApplicationBootstrap {
  private readonly logger = new Logger(ActivityLookupService.name);
  private cache: ActivityLookupCacheSnapshot = buildActivityLookupCache([]);
  private localVersion = '';
  private readonly dataKey: string;
  private readonly versionKey: string;
  private readonly ttlSec: number;

  constructor(
    @InjectModel(Activity.name)
    private readonly model: Model<Activity>,
    @InjectModel(ArtistPerformance.name)
    private readonly performanceModel: Model<ArtistPerformance>,
    private readonly jsonCache: RedisMemoryJsonCacheService,
    private readonly activityImages: ActivityImageService,
    config: ConfigService,
  ) {
    this.dataKey =
      config.get('catalog.activity.dataKey') ?? 'catalog:activity:v1';
    this.versionKey =
      config.get('catalog.activity.versionKey') ?? 'catalog:activity:version';
    this.ttlSec = config.get('catalog.activity.ttlSec') ?? 86_400;
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.refreshCache();
    this.logger.log(
      `Activity catalog cache warmed (${this.cache.all.length} records)`,
    );
  }

  async refreshCache(): Promise<void> {
    const [activities, publishedLegacyIds] = await Promise.all([
      this.model.find().sort({ legacyId: 1 }).lean(),
      this.loadPublishedActivityLegacyIds(),
    ]);

    const records: ActivityLookupRecord[] = activities.map((activity) => {
      const structuredDates = resolveActivityStructuredDates(activity);
      return {
        ...activity,
        ...structuredDates,
        lineupPublished: isActivityLineupPublished(
          activity.legacyId,
          publishedLegacyIds.has(activity.legacyId),
        ),
      };
    });

    this.applyRecords(records);
    await this.jsonCache.setJson(this.dataKey, { records }, this.ttlSec);
    this.localVersion = await this.jsonCache.bumpVersion(this.versionKey);
  }

  async findAll(): Promise<ActivityLookupRecord[]> {
    await this.syncIfStale();
    const resolved =
      await this.activityImages.resolveRecords<ActivityLookupRecord>([
        ...this.cache.all,
      ]);
    return resolved.map((record) => enrichActivityLookupRecord(record));
  }

  async findAllBasics(): Promise<ActivityLookupRecord[]> {
    await this.syncIfStale();
    return this.cache.all.map((record) => enrichActivityLookupRecord(record));
  }

  async findByLegacyId(legacyId: number): Promise<ActivityLookupRecord | null> {
    await this.syncIfStale();
    const record = this.cache.byLegacyId.get(legacyId) ?? null;
    if (!record) {
      return null;
    }
    const [resolved] =
      await this.activityImages.resolveRecords<ActivityLookupRecord>([record]);
    return resolved ? enrichActivityLookupRecord(resolved) : null;
  }

  async findByLegacyIds(
    legacyIds: number[],
  ): Promise<Map<number, ActivityLookupRecord>> {
    await this.syncIfStale();
    const records = legacyIds
      .map((legacyId) => this.cache.byLegacyId.get(legacyId))
      .filter((record): record is ActivityLookupRecord => Boolean(record));
    const resolved =
      await this.activityImages.resolveRecords<ActivityLookupRecord>(records);
    const map = new Map<number, ActivityLookupRecord>();
    for (const record of resolved) {
      if (record.legacyId != null) {
        map.set(record.legacyId, enrichActivityLookupRecord(record));
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
    const [resolved] =
      await this.activityImages.resolveRecords<ActivityLookupRecord>([record]);
    return resolved ? enrichActivityLookupRecord(resolved) : null;
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
      await this.activityImages.resolveRecords<ActivityLookupRecord>(
        this.cache.all.slice(skip, skip + limit),
      )
    ).map((record) => enrichActivityLookupRecord(record));
    return { items, total, skip, limit };
  }

  private applyRecords(records: ActivityLookupRecord[]): void {
    this.cache = buildActivityLookupCache(records);
  }

  private async loadPublishedActivityLegacyIds(): Promise<Set<number>> {
    const rows = await this.performanceModel
      .aggregate([{ $group: { _id: '$activityLegacyId' } }])
      .exec();
    return new Set(rows.map((row) => row._id as number));
  }

  private async syncIfStale(): Promise<void> {
    const remoteVersion = await this.jsonCache.getVersion(this.versionKey);
    if (remoteVersion && remoteVersion === this.localVersion) {
      return;
    }

    const payload = await this.jsonCache.getJson<{
      records: ActivityLookupRecord[];
    }>(this.dataKey);
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
