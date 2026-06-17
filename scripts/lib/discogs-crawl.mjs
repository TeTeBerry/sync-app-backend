import { existsSync, readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import {
  STORM_LINEUP_ARTIST_NAMES,
  DISCOGS_LINEUP_ARTIST_IDS,
  SEED_ONLY_LINEUP_ARTISTS,
  expandFestivalArtistNames,
  getDiscogsSearchQueries,
  getLineupCoverageKeys,
  LINEUP_MANUAL_DJ_PROFILES,
  loadEdcThailandFallbackNames,
  loadEdcKoreaFallbackNames,
  loadTomorrowlandThailandFallbackNames,
  normalizeArtistNameKey,
} from './festival-lineup-fallback.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
    stormActivityLegacyId: Number(
      process.env.DISCOGS_STORM_ACTIVITY_LEGACY_ID ?? 4,
    ),
    edcThailandActivityLegacyId: Number(
      process.env.DISCOGS_EDC_THAILAND_ACTIVITY_LEGACY_ID ?? 5,
    ),
    edcKoreaActivityLegacyId: Number(
      process.env.DISCOGS_EDC_KOREA_ACTIVITY_LEGACY_ID ?? 8,
    ),
    tomorrowlandThailandActivityLegacyId: Number(
      process.env.DISCOGS_TOMORROWLAND_THAILAND_ACTIVITY_LEGACY_ID ?? 1,
    ),
    requestDelayMs: Number(process.env.DISCOGS_REQUEST_DELAY_MS ?? 1100),
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
      thumbnail: { type: String, default: '' },
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

  async function discogsGet(url, params = {}) {
    const query = new URLSearchParams(params);
    const target = query.size ? `${url}?${query}` : url;
    const res = await fetch(target, { headers });
    if (!res.ok) {
      throw new Error(`Discogs ${res.status}: ${res.statusText}`);
    }
    return res.json();
  }

  async function searchArtistByName(lineupName) {
    const trimmed = lineupName.trim();
    const forcedId = DISCOGS_LINEUP_ARTIST_IDS[trimmed.toUpperCase()];
    if (forcedId) {
      return {
        discogsId: forcedId,
        matchedTitle: trimmed,
        searchQuery: `#${forcedId}`,
      };
    }

    const queries = getDiscogsSearchQueries(lineupName);

    for (const query of queries) {
      await delay(config.requestDelayMs);
      try {
        const data = await discogsGet('https://api.discogs.com/database/search', {
          q: query,
          type: 'artist',
          per_page: '5',
        });
        const results = data.results ?? [];
        if (!results.length) {
          continue;
        }

        const normalized = query.trim().toLowerCase();
        const exact = results.find(
          (item) => item.title?.trim().toLowerCase() === normalized,
        );
        const best = exact ?? results[0];
        if (!best?.id) {
          continue;
        }

        return {
          discogsId: best.id,
          matchedTitle: best.title ?? query,
          searchQuery: query,
        };
      } catch (error) {
        console.warn('搜索艺人失败', query, error.message ?? error);
      }
    }

    return null;
  }

  async function fetchRepresentativeWorks(artistId) {
    const representativeWorks = [];
    const genres = new Set();
    const styles = new Set();

    try {
      await delay(config.requestDelayMs);
      const list = await discogsGet(
        `https://api.discogs.com/artists/${artistId}/releases`,
        {
          per_page: String(config.representativeWorksLimit),
          page: '1',
          sort: 'year',
          sort_order: 'desc',
        },
      );

      for (const item of (list.releases ?? []).slice(
        0,
        config.representativeWorksLimit,
      )) {
        const releaseId = item.main_release ?? item.id;
        if (!releaseId) {
          continue;
        }

        await delay(config.requestDelayMs);
        try {
          const release = await discogsGet(
            `https://api.discogs.com/releases/${releaseId}`,
          );
          for (const genre of release.genres ?? []) {
            genres.add(genre);
          }
          for (const style of release.styles ?? []) {
            styles.add(style);
          }

          const tracks = (release.tracklist ?? [])
            .map((track) => track.title?.trim())
            .filter(Boolean)
            .slice(0, 8);

          representativeWorks.push({
            releaseId,
            title: (release.title ?? item.title ?? '').trim(),
            year: release.year ?? item.year ?? undefined,
            type: (item.type ?? release.type ?? '').trim(),
            tracks,
          });
        } catch (error) {
          console.warn('读取发行详情失败', releaseId, error.message ?? error);
        }
      }
    } catch (error) {
      console.warn('读取艺人发行列表失败', artistId, error.message ?? error);
    }

    return {
      representativeWorks,
      genres: [...genres],
      styles: [...styles],
    };
  }

  async function buildDjRecord(discogsId) {
    await delay(config.requestDelayMs);
    const artist = await discogsGet(`https://api.discogs.com/artists/${discogsId}`);
    const releaseInsights = await fetchRepresentativeWorks(discogsId);
    const profileGenres = Array.isArray(artist.genres) ? artist.genres : [];
    const profileStyles = Array.isArray(artist.styles) ? artist.styles : [];

    return {
      discogsId: artist.id,
      name: artist.name,
      realName: artist.real_name ?? '',
      profile: (artist.profile ?? '').substring(0, 600),
      genres: profileGenres.length ? profileGenres : releaseInsights.genres,
      styles: profileStyles.length ? profileStyles : releaseInsights.styles,
      country: artist.country ?? '',
      urls: artist.urls ?? [],
      members: Array.isArray(artist.members)
        ? artist.members.map((member) => member.name)
        : [],
      thumbnail: artist.images?.[0]?.uri ?? '',
      representativeWorks: releaseInsights.representativeWorks,
      crawledAt: new Date(),
    };
  }

  return {
    searchArtistByName,
    buildDjRecord,
  };
}

export async function loadLineupArtistNames(db, activityLegacyId, fallbackNames, label) {
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

  console.log(`ℹ️  ${label}: seed fallback，${fallbackNames.length} 条阵容名`);
  return [...fallbackNames];
}

export async function loadFestivalLineupArtistNames(db, config) {
  const storm = await loadLineupArtistNames(
    db,
    config.stormActivityLegacyId,
    STORM_LINEUP_ARTIST_NAMES,
    '风暴',
  );
  const edc = await loadLineupArtistNames(
    db,
    config.edcThailandActivityLegacyId,
    loadEdcThailandFallbackNames(),
    'EDC Thailand',
  );
  const edcKorea = await loadLineupArtistNames(
    db,
    config.edcKoreaActivityLegacyId,
    loadEdcKoreaFallbackNames(),
    'EDC Korea',
  );
  const tomorrowland = await loadLineupArtistNames(
    db,
    config.tomorrowlandThailandActivityLegacyId,
    loadTomorrowlandThailandFallbackNames(),
    'Tomorrowland Thailand',
  );

  return expandFestivalArtistNames([
    ...storm,
    ...edc,
    ...edcKorea,
    ...tomorrowland,
  ]);
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
    return targetKeys.some(
      (targetKey) =>
        djKey === targetKey ||
        djKey.includes(targetKey) ||
        targetKey.includes(djKey),
    );
  });
}

export async function findMissingFestivalArtists(db, config) {
  const expected = await loadFestivalLineupArtistNames(db, config);
  const djs = await db.collection('djs').find({}).project({ name: 1 }).toArray();
  return expected.filter((name) => !isLineupArtistCovered(name, djs));
}

export async function upsertDjRecord(Dj, data) {
  await Dj.updateOne({ discogsId: data.discogsId }, { $set: data }, { upsert: true });

  const worksLabel = data.representativeWorks.length
    ? ` | 近期发行 ${data.representativeWorks.length} 条`
    : '';
  console.log('✅ 已入库:', data.name, worksLabel);
}

export async function crawlArtistNames({
  artistNames,
  discogs,
  Dj,
  label = '艺人',
}) {
  let upserted = 0;
  let missed = 0;
  const seenDiscogsIds = new Set();

  for (const artistName of artistNames) {
    console.log(`\n查找 ${label}:`, artistName);
    const manualProfile =
      LINEUP_MANUAL_DJ_PROFILES[artistName.trim().toUpperCase()];
    if (manualProfile) {
      const data = { ...manualProfile, crawledAt: new Date() };
      await upsertDjRecord(Dj, data);
      upserted += 1;
      console.log('→ 人工档案（无 Discogs 艺人页）');
      continue;
    }
    if (SEED_ONLY_LINEUP_ARTISTS.has(artistName.trim().toUpperCase())) {
      console.log('↷ 跳过（Discogs 无可靠条目，保留 seed 风格）');
      continue;
    }
    const match = await discogs.searchArtistByName(artistName);
    if (!match) {
      missed += 1;
      console.warn('⚠️  未找到:', artistName);
      continue;
    }

    if (seenDiscogsIds.has(match.discogsId)) {
      console.log(`↷ 跳过重复 Discogs #${match.discogsId} (${match.matchedTitle})`);
      continue;
    }
    seenDiscogsIds.add(match.discogsId);

    console.log(
      `→ Discogs #${match.discogsId} (${match.matchedTitle}) [query: ${match.searchQuery}]`,
    );

    try {
      const data = await discogs.buildDjRecord(match.discogsId);
      await upsertDjRecord(Dj, data);
      upserted += 1;
    } catch (error) {
      missed += 1;
      console.error('获取详情失败', artistName, error.message ?? error);
    }
  }

  return { upserted, missed };
}
