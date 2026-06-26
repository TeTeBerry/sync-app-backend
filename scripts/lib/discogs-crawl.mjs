import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'node:child_process';
import {
  expandFestivalArtistNames,
  getLineupCoverageKeys,
  LINEUP_MANUAL_DJ_PROFILES,
  normalizeArtistNameKey,
} from './festival-lineup-fallback.mjs';
import {
  DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
  DISCOGS_REVIEW_REASON,
} from './lineup-discogs-search.mjs';
import { createDiscogsArtistResolver } from './discogs-artist-resolve.mjs';
import {
  getDjStylesRedisCache,
  setDjStylesRedisCache,
  deleteDjStylesRedisCache,
} from './discogs-redis-cache.mjs';
import { resolveDistRoot, requireFromDist } from './resolve-dist-root.mjs';
import {
  upsertDjDiscogsMapMapped,
  upsertDjDiscogsMapPendingReview,
  createDjDiscogsMapModel,
  deleteDjDiscogsMapEntry,
  findDjDiscogsMapEntry,
} from './dj-discogs-map.mjs';
import {
  buildWebOnlyDjRecord,
  allocateSyntheticDiscogsId,
  isSyntheticDiscogsId,
} from './web-only-dj-profile.mjs';

export { closeDjDiscogsRedisCache, deleteDjStylesRedisCache } from './discogs-redis-cache.mjs';
export { createDjDiscogsMapModel } from './dj-discogs-map.mjs';
export { listMappedLineupArtists, listAllMappedLineupNames } from './dj-discogs-map.mjs';
export {
  expandFestivalArtistNames,
  expandFestivalArtistName,
  isCompositeLineupDisplayName,
} from './festival-lineup-fallback.mjs';

export async function clearLineupArtistRematchState(
  mapCollection,
  lineupNames,
) {
  let clearedMaps = 0;
  let clearedStyleRedis = 0;

  for (const lineupName of lineupNames) {
    const existing = await deleteDjDiscogsMapEntry(mapCollection, lineupName);
    if (existing) {
      clearedMaps += 1;
      if (existing.discogsId) {
        if (await deleteDjStylesRedisCache(existing.discogsId)) {
          clearedStyleRedis += 1;
        }
      }
    }
  }

  return { clearedMaps, clearedStyleRedis };
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

function ensureDistBuilt() {
  if (resolveDistRoot()) {
    return;
  }
  console.log('dist missing — building for Discogs style util…');
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

function loadDiscogsStyleUtil() {
  ensureDistBuilt();
  return requireFromDist('modules/dj/discogs-dj-styles.util');
}

function loadDiscogsMatchUtil() {
  ensureDistBuilt();
  return requireFromDist('modules/dj/discogs-artist-match.util');
}

export function loadDotEnv() {
  const root = join(__dirname, '..', '..');
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const paths = [
    join(root, '.env'),
    join(root, '.env.local'),
    join(root, `.env.${nodeEnv}`),
    join(root, `.env.${nodeEnv}.local`),
  ];

  for (const envPath of paths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }
      const eq = trimmed.indexOf('=');
      if (eq <= 0) {
        continue;
      }
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      process.env[key] = value;
    }
  }
}

export function getCrawlConfig() {
  return {
    discogsToken: process.env.DISCOGS_TOKEN?.trim() ?? '',
    mongoUri:
      process.env.MONGODB_URI ??
      process.env.MONGO_URI ??
      'mongodb://127.0.0.1:27017/sync-ai',
    requestDelayMs: Number(process.env.DISCOGS_REQUEST_DELAY_MS ?? 1200),
    releasesPageSize: Number(process.env.DISCOGS_RELEASES_PAGE_SIZE ?? 100),
    releaseSampleSize: Math.min(
      Math.max(Number(process.env.DISCOGS_RELEASE_SAMPLE_SIZE ?? 8), 1),
      10,
    ),
    mainStylesTopN: Math.min(
      Math.max(Number(process.env.DISCOGS_MAIN_STYLES_TOP_N ?? 3), 1),
      10,
    ),
    representativeWorksLimit: Math.min(
      Math.max(Number(process.env.DISCOGS_REPRESENTATIVE_WORKS_LIMIT ?? 5), 1),
      10,
    ),
  };
}

/** Keep in sync with `src/database/schemas/dj.schema.ts` */
export function createDjModel(mongoose) {
  const djSchema = new mongoose.Schema(
    {
      discogsId: { type: Number, unique: true, required: true },
      name: { type: String, required: true },
      realName: { type: String, default: '' },
      profile: { type: String, default: '' },
      genres: { type: [String], default: [] },
      styles: { type: [String], default: [] },
      country: { type: String, default: '' },
      urls: { type: [String], default: [] },
      members: { type: [String], default: [] },
      representativeWorks: {
        type: [
          {
            releaseId: { type: Number, required: true },
            title: { type: String, required: true },
            year: { type: Number },
            type: { type: String },
            tracks: { type: [String], default: [] },
          },
        ],
        default: [],
      },
      crawledAt: { type: Date, default: Date.now },
    },
    { collection: 'djs', timestamps: true },
  );

  return mongoose.models.Dj ?? mongoose.model('Dj', djSchema);
}

export function createDiscogsClient(config) {
  const headers = {
    'User-Agent': 'SyncElectronicDJAgent/1.0',
    Authorization: `Discogs token=${config.discogsToken}`,
  };

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  async function discogsGet(url, params = {}, attempt = 0) {
    const query = new URLSearchParams(params);
    const target = query.size ? `${url}?${query}` : url;
    const res = await fetch(target, { headers });
    const retryable =
      res.status === 429 ||
      res.status === 502 ||
      res.status === 503 ||
      res.status === 504;
    if (retryable && attempt < 5) {
      const waitMs = config.requestDelayMs * (attempt + 2);
      console.warn(
        `Discogs ${res.status}，${waitMs}ms 后重试 (${attempt + 1}/5): ${target}`,
      );
      await delay(waitMs);
      return discogsGet(url, params, attempt + 1);
    }
    if (!res.ok) {
      throw new Error(`Discogs ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }

  async function fetchReleaseInsights(artistId) {
    const cached = await getDjStylesRedisCache(artistId);
    if (cached && Array.isArray(cached.styles)) {
      return {
        representativeWorks: cached.representativeWorks ?? [],
        genres: cached.genres ?? [],
        styles: cached.styles ?? [],
        fromStylesCache: true,
      };
    }

    const styleUtil = loadDiscogsStyleUtil();
    const representativeWorks = [];
    const releaseTags = [];
    const styleSampleSize = config.releaseSampleSize;
    const worksSampleSize = config.representativeWorksLimit;
    const fetchCount = Math.max(styleSampleSize, worksSampleSize);

    try {
      await delay(config.requestDelayMs);
      const list = await discogsGet(
        `https://api.discogs.com/artists/${artistId}/releases`,
        {
          per_page: String(config.releasesPageSize),
          page: '1',
          sort: 'year',
          sort_order: 'desc',
        },
      );

      const releaseItems = styleUtil.pickReleasesForStyleSampling(
        list.releases ?? [],
        fetchCount,
      );

      const fetchedReleases = [];
      for (const item of releaseItems) {
        const releaseId = item.main_release ?? item.id;
        const releaseUrl =
          item.resource_url?.trim() ||
          (releaseId ? `https://api.discogs.com/releases/${releaseId}` : '');
        if (!releaseUrl) {
          continue;
        }

        await delay(config.requestDelayMs);
        try {
          const release = await discogsGet(releaseUrl);
          releaseTags.push({
            genres: release.genres ?? [],
            styles: release.styles ?? [],
          });

          const resolvedReleaseId = release.id ?? releaseId;
          const tracks = (release.tracklist ?? [])
            .map((track) => track.title?.trim())
            .filter(Boolean)
            .slice(0, 8);

          fetchedReleases.push({
            releaseId: resolvedReleaseId,
            title: (release.title ?? item.title ?? '').trim(),
            year: release.year ?? item.year ?? undefined,
            type: (item.type ?? release.type ?? '').trim(),
            tracks,
            genres: release.genres ?? [],
            styles: release.styles ?? [],
          });
        } catch (error) {
          console.warn('读取发行详情失败', releaseUrl, error.message ?? error);
        }
      }

      for (const release of fetchedReleases.slice(0, styleSampleSize)) {
        releaseTags.push({
          genres: release.genres,
          styles: release.styles,
        });
      }

      for (const release of fetchedReleases.slice(0, worksSampleSize)) {
        representativeWorks.push({
          releaseId: release.releaseId,
          title: release.title,
          year: release.year,
          type: release.type,
          tracks: release.tracks,
        });
      }
    } catch (error) {
      console.warn('读取艺人发行列表失败', artistId, error.message ?? error);
    }

    const aggregated = styleUtil.aggregateDiscogsReleaseStyles(releaseTags, {
      topStyles: config.mainStylesTopN,
    });
    const payload = {
      genres: aggregated.genres,
      styles: aggregated.styles,
      representativeWorks,
    };

    await setDjStylesRedisCache(artistId, payload);

    return {
      ...payload,
      fromStylesCache: false,
    };
  }

  async function buildDjRecord(discogsId, options = {}) {
    const prefetched = options.prefetchedArtist;
    const artist =
      prefetched?.id === discogsId
        ? prefetched
        : await (async () => {
            await delay(config.requestDelayMs);
            const raw = await discogsGet(
              `https://api.discogs.com/artists/${discogsId}`,
            );
            return {
              id: raw.id,
              name: raw.name,
              realName: raw.real_name ?? '',
              profile: raw.profile ?? '',
              country: raw.country ?? '',
              urls: raw.urls ?? [],
              members: Array.isArray(raw.members)
                ? raw.members.map((member) => member.name)
                : [],
            };
          })();

    const releaseInsights = await fetchReleaseInsights(discogsId);
    const profileText = (artist.profile ?? '').substring(0, 600);
    if (profileText) {
      console.log(`→ 简介 ${profileText.length} 字`);
    } else {
      console.warn('⚠️  该艺人 Discogs 页无 profile 文本');
    }
    if (releaseInsights.fromStylesCache) {
      console.log(
        `↷ 主风格 Redis 缓存命中 #${discogsId} → ${releaseInsights.styles.join(' · ') || '无'}`,
      );
    } else if (releaseInsights.styles.length) {
      console.log(
        `→ 主风格 Top${config.mainStylesTopN}: ${releaseInsights.styles.join(' · ')}`,
      );
    }

    return {
      discogsId: artist.id,
      name: options.preferredName?.trim() || artist.name,
      realName: artist.realName ?? '',
      profile: profileText,
      genres: releaseInsights.genres,
      styles: releaseInsights.styles,
      country: artist.country ?? '',
      urls: artist.urls ?? [],
      members: Array.isArray(artist.members)
        ? artist.members.map((member) => member.name)
        : [],
      representativeWorks: releaseInsights.representativeWorks,
      crawledAt: new Date(),
    };
  }

  const resolver = createDiscogsArtistResolver(config, discogsGet, delay);
  const { isVerifiableDiscogsDjRecord } = loadDiscogsMatchUtil();

  return {
    discogsGet,
    resolveArtistMatch: resolver.resolveArtistMatch,
    previewArtistMatch: resolver.previewArtistMatch,
    buildDjRecord,
    isVerifiableDiscogsDjRecord,
  };
}

export async function loadLineupArtistNames(db, activityLegacyId, label) {
  const rows = await db
    .collection('artist_performances')
    .find({ activityLegacyId })
    .project({ artistName: 1 })
    .toArray();

  const fromMongo = [
    ...new Set(
      rows
        .map((row) => row.artistName?.trim())
        .filter((name) => name && name !== '国内艺人'),
    ),
  ];

  if (fromMongo.length) {
    console.log(
      `ℹ️  ${label}: Mongo activityLegacyId=${activityLegacyId}，${fromMongo.length} 条阵容名`,
    );
    return fromMongo;
  }

  console.warn(
    `⚠️  ${label}: activityLegacyId=${activityLegacyId} 无 artist_performances（请先 npm run db:seed-itinerary 或写入阵容）`,
  );
  return [];
}

/** Lineup display names from Mongo artist_performances only (no seed fallback). */
export async function loadAllCatalogLineupDisplayNames(db, _config) {
  const activities = await db
    .collection('activities')
    .find({})
    .project({ legacyId: 1, name: 1 })
    .toArray();

  const names = [];

  for (const activity of activities) {
    const legacyId = Number(activity.legacyId);
    if (!Number.isFinite(legacyId)) {
      continue;
    }
    const label = activity.name?.trim() || `#${legacyId}`;
    const activityNames = await loadLineupArtistNames(db, legacyId, label);
    names.push(...activityNames);
  }

  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

/** Normalized keys + avatar keys for every lineup display / expanded solo name. */
export function buildLineupArtistScope(displayNames) {
  const expandedNames = expandFestivalArtistNames(displayNames);
  const allNames = [
    ...new Set(
      [...displayNames, ...expandedNames]
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ];
  const allowedKeys = new Set();

  for (const name of allNames) {
    for (const key of getLineupCoverageKeys(name)) {
      if (key) {
        allowedKeys.add(key);
      }
    }
  }

  const allowedAvatarKeys = new Set(
    allNames.map((name) => name.toLowerCase()),
  );

  return {
    displayNames,
    expandedNames,
    allNames,
    allowedKeys,
    allowedAvatarKeys,
  };
}

/** All lineup artist names across every activity in the catalog. */
export async function loadAllCatalogLineupArtistNames(db, config) {
  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  return expandFestivalArtistNames(displayNames);
}

/** Strict keys from lineup display names only (artist_performances 录入名). */
export function buildStrictLineupScope(displayNames) {
  const names = [...new Set(displayNames.map((name) => name.trim()).filter(Boolean))];
  const allowedKeys = new Set(
    names.map((name) => normalizeArtistNameKey(name)).filter(Boolean),
  );
  const allowedAvatarKeys = new Set(names.map((name) => name.toLowerCase()));

  return {
    displayNames: names,
    allowedKeys,
    allowedAvatarKeys,
  };
}

/** Rows outside lineup 录入名 — exact key match only, no fuzzy / alias validation. */
export async function findOrphanLineupArtistRows(db, config) {
  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  const scope = buildStrictLineupScope(displayNames);

  const [djs, maps, avatars] = await Promise.all([
    db.collection('djs').find({}).toArray(),
    db.collection('dj_discogs_map').find({}).toArray(),
    db.collection('lineup_artist_avatars').find({}).toArray(),
  ]);

  const orphanMaps = maps.filter(
    (row) => !scope.allowedKeys.has(row.lineupNameKey),
  );
  const orphanDjs = djs.filter(
    (dj) => !scope.allowedKeys.has(normalizeArtistNameKey(dj.name ?? '')),
  );
  const orphanAvatars = avatars.filter(
    (row) => !scope.allowedAvatarKeys.has(row.artistNameKey),
  );

  return {
    scope,
    orphanDjs,
    orphanMaps,
    orphanAvatars,
  };
}

export function findDjForLineupName(lineupName, djs) {
  const targetKeys = getLineupCoverageKeys(lineupName);
  if (!targetKeys.length) {
    return null;
  }

  return (
    djs.find((dj) => {
      const djKey = normalizeArtistNameKey(dj.name ?? '');
      if (!djKey) {
        return false;
      }
      return targetKeys.some((targetKey) => djKey === targetKey);
    }) ?? null
  );
}

/** Lineup names for one festival (Mongo artist_performances only). */
export async function loadActivityLineupArtistNames(db, activityLegacyId) {
  const activity = await db
    .collection('activities')
    .findOne({ legacyId: activityLegacyId }, { projection: { name: 1 } });
  const label = activity?.name?.trim() || `#${activityLegacyId}`;
  const names = await loadLineupArtistNames(db, activityLegacyId, label);
  return expandFestivalArtistNames(names);
}

/** Split lineup names into already in DB / still missing for Discogs. */
export async function partitionLineupArtistCoverage(db, expectedNames) {
  const djs = await db
    .collection('djs')
    .find({})
    .project({ name: 1, discogsId: 1 })
    .toArray();

  const covered = [];
  const missing = [];

  for (const name of expectedNames) {
    const trimmed = name.trim();
    if (!trimmed) {
      continue;
    }
    if (isLineupArtistCovered(name, djs)) {
      covered.push(name);
      continue;
    }
    missing.push(name);
  }

  return { covered, missing, djs };
}

export async function findMissingCatalogArtists(db, config) {
  const expected = await loadAllCatalogLineupArtistNames(db, config);
  const { missing } = await partitionLineupArtistCoverage(db, expected);
  return missing;
}

/** Lineup names in scope that have dj_discogs_map status=pending_review. */
export async function listPendingReviewLineupArtists(db, lineupNames) {
  const keys = [
    ...new Set(
      lineupNames.map((name) => normalizeArtistNameKey(name)).filter(Boolean),
    ),
  ];
  if (!keys.length) {
    return [];
  }

  const rows = await db
    .collection('dj_discogs_map')
    .find({
      lineupNameKey: { $in: keys },
      status: 'pending_review',
    })
    .project({ lineupName: 1, lineupNameKey: 1 })
    .toArray();

  const byKey = new Map(rows.map((row) => [row.lineupNameKey, row.lineupName]));
  const pending = [];
  const seen = new Set();

  for (const name of lineupNames) {
    const key = normalizeArtistNameKey(name);
    if (!byKey.has(key) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    pending.push(byKey.get(key) ?? name);
  }

  return pending;
}

export async function listPendingReviewCatalogArtists(db, config) {
  const expected = await loadAllCatalogLineupArtistNames(db, config);
  return listPendingReviewLineupArtists(db, expected);
}

export function isLineupArtistCovered(lineupName, djs) {
  const targetKeys = getLineupCoverageKeys(lineupName);
  if (!targetKeys.length) {
    return true;
  }

  return djs.some((dj) => {
    const djKey = normalizeArtistNameKey(dj.name ?? '');
    if (!djKey) {
      return false;
    }
    return targetKeys.some((targetKey) => djKey === targetKey);
  });
}

export async function upsertDjRecord(Dj, data) {
  await Dj.updateOne(
    { discogsId: data.discogsId },
    { $set: data },
    { upsert: true },
  );

  const worksLabel = data.representativeWorks.length
    ? ` | 近期发行 ${data.representativeWorks.length} 条`
    : '';
  console.log('✅ 已入库:', data.name, worksLabel);
}

export async function crawlArtistNames({
  artistNames,
  discogs,
  Dj,
  mapCollection,
  label = '艺人',
}) {
  let upserted = 0;
  let missed = 0;
  let pendingReview = 0;
  const seenDiscogsIds = new Set();

  for (const artistName of artistNames) {
    console.log(`\n查找 ${label}:`, artistName);
    const manualProfile =
      LINEUP_MANUAL_DJ_PROFILES[artistName.trim().toUpperCase()];
    if (manualProfile) {
      const data = { ...manualProfile, crawledAt: new Date() };
      await upsertDjRecord(Dj, data);
      if (mapCollection) {
        await upsertDjDiscogsMapMapped(mapCollection, {
          lineupName: artistName,
          discogsId: manualProfile.discogsId,
          discogsName: manualProfile.name,
          matchScore: 100,
          searchQuery: '#manual-profile',
          source: DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
        });
      }
      upserted += 1;
      console.log('→ 人工档案（无 Discogs 艺人页）');
      continue;
    }

    if (!mapCollection) {
      missed += 1;
      console.warn('⚠️  缺少 dj_discogs_map 集合');
      continue;
    }

    try {
      const match = await discogs.resolveArtistMatch(artistName, mapCollection);
      if (match.status === 'pending_review') {
        pendingReview += 1;
        console.warn('⏸  待复核:', artistName, '-', match.reviewReason);
        continue;
      }

      if (match.webOnly || isSyntheticDiscogsId(match.discogsId)) {
        const mapRow = match.hermesEvidence
          ? {
              hermesEvidence: match.hermesEvidence,
              discogsId: match.discogsId,
              discogsName: match.discogsName,
            }
          : await findDjDiscogsMapEntry(mapCollection, artistName);

        if (!mapRow?.hermesEvidence) {
          missed += 1;
          console.warn(
            '⚠️  web-only mapped 缺少 hermesEvidence，无法写入 djs:',
            artistName,
          );
          continue;
        }

        const syntheticId =
          match.discogsId ?? mapRow.discogsId ?? allocateSyntheticDiscogsId(artistName);

        if (seenDiscogsIds.has(syntheticId)) {
          console.log(
            `↷ 跳过重复 web-only #${syntheticId} (${match.discogsName})`,
          );
          continue;
        }
        seenDiscogsIds.add(syntheticId);

        console.log(
          `→ web-only mapped #${syntheticId} (${match.discogsName ?? artistName}) [${match.fromCache ? 'map:mongo' : 'hermes'}: ${match.searchQuery}]`,
        );

        const data = buildWebOnlyDjRecord({
          lineupName: artistName,
          discogsName: match.discogsName ?? mapRow.discogsName,
          hermesEvidence: mapRow.hermesEvidence,
          discogsId: syntheticId,
        });

        if (!discogs.isVerifiableDiscogsDjRecord(data)) {
          pendingReview += 1;
          await upsertDjDiscogsMapPendingReview(mapCollection, {
            lineupName: artistName,
            searchQuery: match.searchQuery ?? '',
            reviewReason: DISCOGS_REVIEW_REASON.BUILD_RECORD_FAILED,
            candidateScores: [],
            source: DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
          });
          console.warn(
            '⏸  待复核:',
            artistName,
            '-',
            DISCOGS_REVIEW_REASON.BUILD_RECORD_FAILED,
          );
          continue;
        }

        await upsertDjRecord(Dj, data);
        upserted += 1;
        console.log('→ Hermes web 档案（无 Discogs 艺人页）');
        continue;
      }

      if (seenDiscogsIds.has(match.discogsId)) {
        console.log(
          `↷ 跳过重复 Discogs #${match.discogsId} (${match.discogsName})`,
        );
        continue;
      }
      seenDiscogsIds.add(match.discogsId);

      const cacheLabel = match.fromCache
        ? `map:${match.cacheLayer ?? 'mongo'}`
        : 'search';
      console.log(
        `→ Discogs #${match.discogsId} (${match.discogsName}) [${cacheLabel}: ${match.searchQuery}] score=${match.matchScore ?? 'n/a'}`,
      );

      const data = await discogs.buildDjRecord(match.discogsId, {
        preferredName: artistName,
        prefetchedArtist: match.prefetchedArtist,
      });
      if (!discogs.isVerifiableDiscogsDjRecord(data)) {
        pendingReview += 1;
        await upsertDjDiscogsMapPendingReview(mapCollection, {
          lineupName: artistName,
          searchQuery: match.searchQuery ?? '',
          reviewReason: DISCOGS_REVIEW_REASON.BUILD_RECORD_FAILED,
          candidateScores: [
            {
              discogsId: match.discogsId,
              name: match.discogsName ?? artistName,
              total: match.matchScore ?? 0,
            },
          ],
          source: DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
        });
        console.warn(
          '⏸  待复核:',
          artistName,
          '-',
          DISCOGS_REVIEW_REASON.BUILD_RECORD_FAILED,
        );
        continue;
      }
      await upsertDjRecord(Dj, data);
      upserted += 1;
    } catch (error) {
      missed += 1;
      console.error('获取详情失败', artistName, error.message ?? error);
    }
  }

  return { upserted, missed, pendingReview };
}

export async function bumpDjCatalogCacheVersion() {
  const redisUrl = process.env.REDIS_URL?.trim();
  if (!redisUrl) {
    return false;
  }

  try {
    const { Redis } = await import('ioredis');
    const versionKey =
      process.env.CATALOG_DJ_VERSION_KEY ?? 'catalog:dj:version';
    const redis = new Redis(redisUrl);
    await redis.incr(versionKey);
    await redis.quit();
    return true;
  } catch (error) {
    console.warn('⚠️  Redis 缓存版本未更新:', error.message ?? error);
    return false;
  }
}
