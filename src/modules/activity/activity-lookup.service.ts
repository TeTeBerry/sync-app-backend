import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import {
  Activity,
  ActivityDocument,
} from '../../database/schemas/activity.schema';
import { buildActivityLookupCache } from './activity-lookup.cache';
import type {
  ActivityListPage,
  ActivityLookupPageOptions,
  ActivityLookupRecord,
  IActivityLookupPort,
} from './ports/activity-lookup.port';

const DEFAULT_PAGE_LIMIT = 50;
const MAX_PAGE_LIMIT = 100;

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
    private readonly jsonCache: RedisMemoryJsonCacheService,
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
    const records = (await this.model
      .find()
      .sort({ legacyId: 1 })
      .lean()) as ActivityLookupRecord[];
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
    return [...this.cache.all];
  }

  async findByLegacyId(legacyId: number): Promise<ActivityLookupRecord | null> {
    await this.syncIfStale();
    return this.cache.byLegacyId.get(legacyId) ?? null;
  }

  async findByLegacyIds(
    legacyIds: number[],
  ): Promise<Map<number, ActivityLookupRecord>> {
    await this.syncIfStale();
    const map = new Map<number, ActivityLookupRecord>();
    for (const legacyId of legacyIds) {
      const record = this.cache.byLegacyId.get(legacyId);
      if (record) {
        map.set(legacyId, record);
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
    return this.cache.byCode.get(normalized) ?? null;
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
    const items = this.cache.all.slice(skip, skip + limit);

    return { items, total, skip, limit };
  }

  private applyRecords(records: ActivityLookupRecord[]): void {
    this.cache = buildActivityLookupCache(records);
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
