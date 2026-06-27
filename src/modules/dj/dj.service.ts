import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RedisMemoryJsonCacheService } from '../../infra/cache/redis-memory-json-cache.service';
import { Dj, DjDocument } from '../../database/schemas/dj.schema';
import {
  DjDiscogsMap,
  DjDiscogsMapDocument,
} from '../../database/schemas/dj-discogs-map.schema';
import type { DjCatalogItem, DjSearchResult } from './dj.types';
import {
  DISCOGS_LINEUP_SEARCH_ALIASES,
  expandFestivalArtistName,
  matchLineupArtistToCatalog,
  normalizeArtistNameKey,
} from './lineup-name-match.util';
import { resolveLineupDisplayGenreFromCatalog } from '../itinerary/domain/lineup-artist-data-policy';
import { isLineupCatalogNameTrusted } from './lineup-catalog-profile-trust.util';
import {
  buildCatalogNameIndex,
  matchLineupArtistToCatalogIndex,
} from './catalog-name-index.util';
import { DjLocaleService } from './dj-locale.service';
import { hasCjkText } from './dj-country-zh.util';
import { DJ_CHINESE_ALIASES } from './data/dj-chinese-aliases.data';
import {
  getChineseAliasesForArtistName,
  resolveCanonicalNameFromChineseAlias,
} from './dj-chinese-aliases.util';
import {
  catalogItemFromHermesMapRow,
  enrichCatalogItemFromHermesEvidence,
  type HermesEvidencePayload,
} from './hermes-evidence-catalog.util';
import { isWeakCatalogGenreList } from './web-only-genre-normalize.util';

const DEFAULT_LIMIT = 8;
const MAX_LIMIT = 30;

type DjCatalogPayload = {
  items: DjCatalogItem[];
};

type HermesMapRow = {
  lineupName: string;
  lineupNameKey: string;
  discogsId?: number;
  discogsName?: string;
  hermesEvidence?: HermesEvidencePayload;
  displayGenres?: string[];
  displayStyles?: string[];
};

export type LineupCatalogBatchResult = {
  catalogByLineupName: Map<string, DjCatalogItem>;
  genreDisplayByLineupName: Map<string, { genre: string; genreLabel: string }>;
};

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function resolveCatalogChineseAliases(doc: DjDocument | Dj): string[] {
  const stored = doc.chineseAliases?.filter((alias) => alias.trim()) ?? [];
  if (stored.length) {
    return stored;
  }
  return getChineseAliasesForArtistName(doc.name);
}

function toCatalogItem(doc: DjDocument | Dj): DjCatalogItem {
  const chineseAliases = resolveCatalogChineseAliases(doc);
  const urls = doc.urls?.filter((url) => url.trim()) ?? [];
  return {
    discogsId: doc.discogsId,
    name: doc.name,
    realName: doc.realName,
    profile: doc.profile,
    genres: doc.genres ?? [],
    styles: doc.styles ?? [],
    country: doc.country,
    ...(urls.length ? { urls } : {}),
    representativeWorks: doc.representativeWorks ?? [],
    ...(chineseAliases.length ? { chineseAliases } : {}),
  };
}

@Injectable()
export class DjService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DjService.name);
  private catalogCache: DjCatalogItem[] | null = null;
  private catalogNameIndex: Map<string, DjCatalogItem> | null = null;
  private localVersion = '';
  private readonly dataKey: string;
  private readonly versionKey: string;
  private readonly ttlSec: number;

  constructor(
    @InjectModel(Dj.name) private readonly djModel: Model<DjDocument>,
    @InjectModel(DjDiscogsMap.name)
    private readonly djDiscogsMapModel: Model<DjDiscogsMapDocument>,
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
    await this.syncChineseAliases();
    await this.refreshCatalogCache();
    this.logger.log(
      `DJ catalog cache warmed (${this.catalogCache?.length ?? 0} records)`,
    );
  }

  /** Upsert curated Chinese nicknames onto matching DJ documents. */
  async syncChineseAliases(): Promise<void> {
    const docs = await this.djModel
      .find({})
      .select('discogsId name chineseAliases')
      .lean()
      .exec();
    if (!docs.length) {
      return;
    }

    const byNameKey = new Map(
      docs.map((doc) => [normalizeArtistNameKey(doc.name), doc] as const),
    );

    let updated = 0;
    for (const entry of DJ_CHINESE_ALIASES) {
      const doc = byNameKey.get(normalizeArtistNameKey(entry.canonicalName));
      if (!doc) {
        continue;
      }
      const current = doc.chineseAliases ?? [];
      const next = entry.aliases;
      if (
        current.length === next.length &&
        current.every((alias, index) => alias === next[index])
      ) {
        continue;
      }
      await this.djModel.updateOne(
        { discogsId: doc.discogsId },
        { $set: { chineseAliases: next } },
      );
      updated += 1;
    }

    if (updated > 0) {
      this.logger.log(`Synced Chinese aliases for ${updated} DJ records`);
    }
  }

  async refreshCatalogCache(): Promise<void> {
    const docs = await this.djModel.find({}).lean().exec();
    this.catalogCache = docs.map((doc) => toCatalogItem(doc));
    this.catalogNameIndex = buildCatalogNameIndex(this.catalogCache);
    await this.jsonCache.setJson(
      this.dataKey,
      { items: this.catalogCache } satisfies DjCatalogPayload,
      this.ttlSec,
    );
    this.localVersion = await this.jsonCache.bumpVersion(this.versionKey);
  }

  private getCatalogNameIndex(
    catalog: DjCatalogItem[],
  ): Map<string, DjCatalogItem> {
    if (this.catalogCache === catalog && this.catalogNameIndex) {
      return this.catalogNameIndex;
    }
    return buildCatalogNameIndex(catalog);
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
    const resolvedName = resolveCanonicalNameFromChineseAlias(trimmed);
    const searchTerms = [
      ...new Set([trimmed, ...(resolvedName ? [resolvedName] : [])]),
    ];
    const orConditions: Array<Record<string, unknown>> = [];
    for (const term of searchTerms) {
      const pattern = new RegExp(escapeRegex(term), 'i');
      orConditions.push({ name: pattern }, { realName: pattern });
    }
    if (resolvedName || hasCjkText(trimmed)) {
      orConditions.push({ chineseAliases: trimmed });
    }
    const filter = { $or: orConditions };

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

  /** Name-matched catalog rows for a lineup name (B2B expands to multiple DJs). */
  collectCatalogItemsForLineupNameSync(
    lineupName: string,
    catalog: DjCatalogItem[],
    catalogIndex?: Map<string, DjCatalogItem>,
  ): DjCatalogItem[] {
    const index = catalogIndex ?? this.getCatalogNameIndex(catalog);
    const parts = expandFestivalArtistName(lineupName);
    const seen = new Set<number>();
    const items: DjCatalogItem[] = [];

    for (const part of parts.length ? parts : [lineupName]) {
      const match =
        matchLineupArtistToCatalogIndex(part, index) ??
        matchLineupArtistToCatalog(part, catalog);
      if (!match) {
        continue;
      }
      const alias = DISCOGS_LINEUP_SEARCH_ALIASES[part.toUpperCase()];
      if (
        !isLineupCatalogNameTrusted(part, match, {
          allowedCatalogNames: [match.name, ...(alias ? [alias] : [])],
        })
      ) {
        continue;
      }
      if (seen.has(match.discogsId)) {
        continue;
      }
      seen.add(match.discogsId);
      items.push(match);
    }

    return items;
  }

  /** @deprecated Prefer collectCatalogItemsForLineupNameSync — profile gate removed for genres. */
  collectTrustedCatalogItemsForLineupName(
    lineupName: string,
    catalog: DjCatalogItem[],
  ): DjCatalogItem[] {
    return this.collectCatalogItemsForLineupNameSync(lineupName, catalog);
  }

  /** Trusted catalog rows for a lineup name, enriched from Hermes evidence when needed. */
  async collectCatalogItemsForLineupName(
    lineupName: string,
    catalog?: DjCatalogItem[],
    mapByKey?: Map<string, HermesMapRow>,
  ): Promise<DjCatalogItem[]> {
    const resolvedCatalog = catalog ?? (await this.loadCatalog());
    const matched = this.collectCatalogItemsForLineupNameSync(
      lineupName,
      resolvedCatalog,
    );
    const evidenceMap =
      mapByKey ?? (await this.loadHermesEvidenceByLineupNames([lineupName]));
    return this.applyHermesEvidenceToLineupItems(
      lineupName,
      matched,
      evidenceMap,
    );
  }

  /** Batch resolve catalog items + genre display for many lineup names in one pass. */
  async resolveLineupCatalogBatch(
    artistNames: string[],
  ): Promise<LineupCatalogBatchResult> {
    const unique = [
      ...new Set(artistNames.map((name) => name.trim()).filter(Boolean)),
    ];
    if (!unique.length) {
      return {
        catalogByLineupName: new Map(),
        genreDisplayByLineupName: new Map(),
      };
    }

    const evidenceNames = new Set(unique);
    for (const name of unique) {
      for (const part of expandFestivalArtistName(name)) {
        evidenceNames.add(part);
      }
    }

    const catalog = await this.loadCatalog();
    const catalogIndex = this.getCatalogNameIndex(catalog);
    const evidenceMap = await this.loadHermesEvidenceByLineupNames([
      ...evidenceNames,
    ]);

    const catalogByLineupName = new Map<string, DjCatalogItem>();
    const genreDisplayByLineupName = new Map<
      string,
      { genre: string; genreLabel: string }
    >();

    for (const name of unique) {
      const items = this.applyHermesEvidenceToLineupItems(
        name,
        this.collectCatalogItemsForLineupNameSync(name, catalog, catalogIndex),
        evidenceMap,
      );
      const match = items[0];
      if (match) {
        catalogByLineupName.set(name, match);
      }
      genreDisplayByLineupName.set(
        name,
        resolveLineupDisplayGenreFromCatalog(items),
      );
    }

    return { catalogByLineupName, genreDisplayByLineupName };
  }

  private async loadHermesEvidenceByLineupNames(
    lineupNames: string[],
  ): Promise<Map<string, HermesMapRow>> {
    const keys = [
      ...new Set(
        lineupNames.map((name) => normalizeArtistNameKey(name)).filter(Boolean),
      ),
    ];
    if (!keys.length) {
      return new Map();
    }

    const rows = await this.djDiscogsMapModel
      .find({
        lineupNameKey: { $in: keys },
        $or: [
          { hermesEvidence: { $exists: true, $ne: null } },
          { displayGenres: { $exists: true, $ne: [] } },
        ],
      })
      .select(
        'lineupName lineupNameKey discogsId discogsName hermesEvidence displayGenres displayStyles',
      )
      .lean()
      .exec();

    return new Map(rows.map((row) => [row.lineupNameKey, row]));
  }

  private applyHermesEvidenceToLineupItems(
    lineupName: string,
    items: DjCatalogItem[],
    mapByKey: Map<string, HermesMapRow>,
  ): DjCatalogItem[] {
    const mapRow = mapByKey.get(normalizeArtistNameKey(lineupName));
    if (!mapRow) {
      return items;
    }

    const evidencePayload = mapRow.hermesEvidence;
    const precomputed =
      mapRow.displayGenres?.length || mapRow.displayStyles?.length
        ? {
            genres: mapRow.displayGenres ?? [],
            styles: mapRow.displayStyles ?? mapRow.displayGenres ?? [],
          }
        : null;

    if (items.length) {
      return items.map((item) => {
        let enriched = item;
        if (precomputed && isWeakCatalogGenreList(item.genres)) {
          enriched = {
            ...enriched,
            genres: precomputed.genres,
            styles: precomputed.styles,
          };
        }
        if (evidencePayload) {
          enriched = enrichCatalogItemFromHermesEvidence(
            enriched,
            evidencePayload,
          );
        }
        return enriched;
      });
    }

    if (precomputed && mapRow.discogsId) {
      const base: DjCatalogItem = {
        discogsId: mapRow.discogsId,
        name: mapRow.discogsName?.trim() || lineupName.trim(),
        genres: precomputed.genres,
        styles: precomputed.styles,
      };
      return evidencePayload
        ? [enrichCatalogItemFromHermesEvidence(base, evidencePayload)]
        : [base];
    }

    if (!evidencePayload) {
      return items;
    }

    const synthetic = catalogItemFromHermesMapRow(mapRow);
    return synthetic ? [synthetic] : [];
  }

  /** Map lineup `artistName` → display genre from mapped Discogs catalog (B2B-aware). */
  async resolveLineupGenreDisplayForArtists(
    artistNames: string[],
  ): Promise<Map<string, { genre: string; genreLabel: string }>> {
    const batch = await this.resolveLineupCatalogBatch(artistNames);
    return batch.genreDisplayByLineupName;
  }

  /** Map lineup `artistName` → Discogs catalog item (B2B / alias aware). */
  async lookupForLineupArtists(
    artistNames: string[],
  ): Promise<Map<string, DjCatalogItem>> {
    const batch = await this.resolveLineupCatalogBatch(artistNames);
    return batch.catalogByLineupName;
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
      this.catalogNameIndex = buildCatalogNameIndex(this.catalogCache);
      this.localVersion = remoteVersion ?? this.localVersion;
      return;
    }

    if (this.catalogCache && !remoteVersion) {
      return;
    }

    await this.refreshCatalogCache();
  }
}
