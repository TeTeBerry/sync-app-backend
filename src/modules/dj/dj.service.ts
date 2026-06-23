import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import { Dj, DjDocument } from '../../database/schemas/dj.schema';
import type { DjCatalogItem, DjSearchResult } from './dj.types';
import { matchLineupArtistToCatalog } from './lineup-name-match.util';
import { DjLocaleService } from './dj-locale.service';
import { hasCjkText } from './dj-country-zh.util';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 30;

type DjCatalogPayload = {
  items: DjCatalogItem[];
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function toCatalogItem(doc: DjDocument | Dj): DjCatalogItem {
  return {
    discogsId: doc.discogsId,
    name: doc.name,
    realName: doc.realName,
    profile: doc.profile,
    genres: doc.genres ?? [],
    styles: doc.styles ?? [],
    country: doc.country,
    representativeWorks: doc.representativeWorks ?? [],
  };
}

@Injectable()
export class DjService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DjService.name);
  private catalogCache: DjCatalogItem[] | null = null;
  private localVersion = '';
  private readonly dataKey: string;
  private readonly versionKey: string;
  private readonly ttlSec: number;

  constructor(
    @InjectModel(Dj.name) private readonly djModel: Model<DjDocument>,
    private readonly jsonCache: RedisMemoryJsonCacheService,
    private readonly djLocaleService: DjLocaleService,
    config: ConfigService,
  ) {
    this.dataKey = config.get<string>('catalog.dj.dataKey') ?? 'catalog:dj:v1';
    this.versionKey =
      config.get<string>('catalog.dj.versionKey') ?? 'catalog:dj:version';
    this.ttlSec = config.get<number>('catalog.dj.ttlSec') ?? 86_400;
  }

  async onApplicationBootstrap() {
    await this.refreshCatalogCache();
    this.logger.log(
      `DJ catalog cache warmed (${this.catalogCache?.length ?? 0} records)`,
    );
  }

  async refreshCatalogCache(): Promise<void> {
    const docs = await this.djModel.find({}).lean().exec();
    this.catalogCache = docs.map((doc) => toCatalogItem(doc));
    await this.jsonCache.setJson(
      this.dataKey,
      { items: this.catalogCache } satisfies DjCatalogPayload,
      this.ttlSec,
    );
    this.localVersion = await this.jsonCache.bumpVersion(this.versionKey);
  }

  async findByDiscogsId(discogsId: number): Promise<DjCatalogItem | null> {
    if (!Number.isFinite(discogsId) || discogsId <= 0) {
      return null;
    }
    const doc = await this.djModel.findOne({ discogsId }).lean().exec();
    return doc ? toCatalogItem(doc) : null;
  }

  /**
   * Returns Chinese profile when available; translates via LLM once and persists
   * to `profileZh` keyed by source `profile` text.
   */
  async resolveProfileForDisplay(
    discogsId: number,
    profile?: string,
  ): Promise<string> {
    const source = profile?.trim() ?? '';
    if (!source) {
      return '';
    }
    if (hasCjkText(source)) {
      return source;
    }
    if (!Number.isFinite(discogsId) || discogsId <= 0) {
      return source;
    }

    const doc = await this.djModel
      .findOne({ discogsId })
      .select('profileZh profileZhSource')
      .lean()
      .exec();

    const cachedZh = doc?.profileZh?.trim();
    if (cachedZh && doc?.profileZhSource === source) {
      return cachedZh;
    }

    const translated = await this.djLocaleService.localizeProfile(source);
    const resolved = translated?.trim() || source;

    if (resolved !== source && hasCjkText(resolved)) {
      await this.djModel.updateOne(
        { discogsId },
        { $set: { profileZh: resolved, profileZhSource: source } },
      );
    }

    return resolved;
  }

  async searchByName(
    keyword: string,
    options?: { limit?: number; skip?: number },
  ): Promise<DjSearchResult> {
    const trimmed = keyword.trim();
    if (!trimmed) {
      return { items: [], total: 0, limit: 0, skip: 0 };
    }

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const skip = Math.max(options?.skip ?? 0, 0);
    const pattern = new RegExp(escapeRegex(trimmed), 'i');
    const filter = {
      $or: [{ name: pattern }, { realName: pattern }],
    };

    const [items, total] = await Promise.all([
      this.djModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.djModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => toCatalogItem(item)),
      total,
      limit,
      skip,
    };
  }

  async loadCatalog(): Promise<DjCatalogItem[]> {
    await this.syncIfStale();
    return this.catalogCache ?? [];
  }

  /** Map lineup `artistName` → Discogs catalog item (B2B / alias aware). */
  async lookupForLineupArtists(
    artistNames: string[],
  ): Promise<Map<string, DjCatalogItem>> {
    const unique = [
      ...new Set(artistNames.map((name) => name.trim()).filter(Boolean)),
    ];
    if (!unique.length) {
      return new Map();
    }

    const catalog = await this.loadCatalog();
    const result = new Map<string, DjCatalogItem>();
    for (const name of unique) {
      const match = matchLineupArtistToCatalog(name, catalog);
      if (match) {
        result.set(name, match);
      }
    }
    return result;
  }

  async searchByStyles(
    styles: string[],
    options?: { limit?: number; skip?: number },
  ): Promise<DjSearchResult> {
    const normalized = [
      ...new Set(
        styles.map((style) => style.trim()).filter((style) => style.length > 0),
      ),
    ];
    if (!normalized.length) {
      return { items: [], total: 0, limit: 0, skip: 0 };
    }

    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_LIMIT, 1),
      MAX_LIMIT,
    );
    const skip = Math.max(options?.skip ?? 0, 0);
    const pattern = new RegExp(
      normalized.map((style) => escapeRegex(style)).join('|'),
      'i',
    );
    const filter = {
      $or: [{ styles: pattern }, { genres: pattern }],
    };

    const [items, total] = await Promise.all([
      this.djModel
        .find(filter)
        .sort({ name: 1 })
        .skip(skip)
        .limit(limit)
        .lean()
        .exec(),
      this.djModel.countDocuments(filter),
    ]);

    return {
      items: items.map((item) => toCatalogItem(item)),
      total,
      limit,
      skip,
    };
  }

  private async syncIfStale(): Promise<void> {
    const remoteVersion = await this.jsonCache.getVersion(this.versionKey);
    if (
      remoteVersion &&
      remoteVersion === this.localVersion &&
      this.catalogCache
    ) {
      return;
    }

    const payload = await this.jsonCache.getJson<DjCatalogPayload>(
      this.dataKey,
    );
    if (payload?.items) {
      this.catalogCache = payload.items;
      this.localVersion = remoteVersion ?? this.localVersion;
      return;
    }

    if (this.catalogCache && !remoteVersion) {
      return;
    }

    await this.refreshCatalogCache();
  }
}
