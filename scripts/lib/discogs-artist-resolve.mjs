import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISCOGS_LINEUP_ARTIST_IDS, getDiscogsSearchQueries } from './festival-lineup-fallback.mjs';
import {
  findDjDiscogsMapEntry,
  upsertDjDiscogsMapMapped,
  upsertDjDiscogsMapPendingReview,
} from './dj-discogs-map.mjs';
import {
  getDjDiscogsRedisCache,
  setDjDiscogsRedisCache,
} from './discogs-redis-cache.mjs';
import { resolveDistRoot, requireFromDist } from './resolve-dist-root.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..');

function ensureDistBuilt() {
  if (resolveDistRoot()) {
    return;
  }
  console.log('dist missing — building for Discogs match util…');
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

function loadMatchUtil() {
  ensureDistBuilt();
  return requireFromDist('modules/dj/discogs-artist-match.util');
}

export function createDiscogsArtistResolver(config, discogsGet, delay) {
  const {
    buildDiscogsElectronicSearchQuery,
    scoreDiscogsArtistCandidate,
    decideDiscogsArtistMatch,
    DISCOGS_SEARCH_CANDIDATE_LIMIT,
    DISCOGS_MATCH_MIN_ACCEPT_SCORE,
    DISCOGS_MATCH_AMBIGUITY_GAP,
  } = loadMatchUtil();

  const minAcceptScore = Number(
    process.env.DISCOGS_MATCH_MIN_SCORE ?? DISCOGS_MATCH_MIN_ACCEPT_SCORE,
  );
  const ambiguityGap = Number(
    process.env.DISCOGS_MATCH_AMBIGUITY_GAP ?? DISCOGS_MATCH_AMBIGUITY_GAP,
  );
  const candidateLimit = Number(
    process.env.DISCOGS_SEARCH_CANDIDATE_LIMIT ?? DISCOGS_SEARCH_CANDIDATE_LIMIT,
  );

  async function fetchReleaseTags(artistId) {
    const releaseGenres = new Set();
    const releaseStyles = new Set();

    try {
      await delay(config.requestDelayMs);
      const list = await discogsGet(
        `https://api.discogs.com/artists/${artistId}/releases`,
        {
          per_page: '1',
          page: '1',
          sort: 'year',
          sort_order: 'desc',
        },
      );
      const first = (list.releases ?? [])[0];
      const releaseId = first?.main_release ?? first?.id;
      if (!releaseId) {
        return { releaseGenres: [], releaseStyles: [] };
      }

      await delay(config.requestDelayMs);
      const release = await discogsGet(
        `https://api.discogs.com/releases/${releaseId}`,
      );
      for (const genre of release.genres ?? []) {
        releaseGenres.add(genre);
      }
      for (const style of release.styles ?? []) {
        releaseStyles.add(style);
      }
    } catch {
      return { releaseGenres: [], releaseStyles: [] };
    }

    return {
      releaseGenres: [...releaseGenres],
      releaseStyles: [...releaseStyles],
    };
  }

  async function fetchArtistCandidate(artistId) {
    await delay(config.requestDelayMs);
    const artist = await discogsGet(`https://api.discogs.com/artists/${artistId}`);
    const releaseTags = await fetchReleaseTags(artistId);

    return {
      id: artist.id,
      name: artist.name,
      profile: artist.profile ?? '',
      genres: Array.isArray(artist.genres) ? artist.genres : [],
      styles: Array.isArray(artist.styles) ? artist.styles : [],
      releaseGenres: releaseTags.releaseGenres,
      releaseStyles: releaseTags.releaseStyles,
    };
  }

  async function searchElectronicCandidates(lineupName) {
    const [primaryQueryName] = getDiscogsSearchQueries(lineupName);
    const searchQuery = buildDiscogsElectronicSearchQuery(primaryQueryName);

    await delay(config.requestDelayMs);
    const data = await discogsGet('https://api.discogs.com/database/search', {
      q: searchQuery,
      type: 'artist',
      strict: '1',
      per_page: String(candidateLimit),
    });

    const results = (data.results ?? []).filter((item) => item.type === 'artist');
    const candidates = [];

    for (const item of results.slice(0, candidateLimit)) {
      if (!item?.id) {
        continue;
      }
      try {
        const candidate = await fetchArtistCandidate(item.id);
        candidates.push(candidate);
      } catch (error) {
        console.warn('读取艺人候选失败', item.id, error.message ?? error);
      }
    }

    return { searchQuery, candidates };
  }

  async function cacheMappedResult(trimmed, payload) {
    await setDjDiscogsRedisCache(trimmed, {
      status: 'mapped',
      discogsId: payload.discogsId,
      discogsName: payload.discogsName,
      matchScore: payload.matchScore,
      searchQuery: payload.searchQuery,
    });
  }

  async function cachePendingReview(trimmed, payload) {
    await setDjDiscogsRedisCache(trimmed, {
      status: 'pending_review',
      reviewReason: payload.reviewReason,
      searchQuery: payload.searchQuery,
    });
  }

  async function resolveArtistMatch(lineupName, mapCollection) {
    const trimmed = lineupName.trim();

    const redisCached = await getDjDiscogsRedisCache(trimmed);
    if (redisCached?.status === 'mapped' && redisCached.discogsId) {
      return {
        status: 'mapped',
        discogsId: redisCached.discogsId,
        discogsName: redisCached.discogsName ?? trimmed,
        searchQuery: redisCached.searchQuery ?? `#redis:${redisCached.discogsId}`,
        matchScore: redisCached.matchScore,
        fromCache: true,
        cacheLayer: 'redis',
      };
    }
    if (redisCached?.status === 'pending_review') {
      return {
        status: 'pending_review',
        reviewReason: redisCached.reviewReason ?? '待复核',
        fromCache: true,
        cacheLayer: 'redis',
      };
    }

    const cached = await findDjDiscogsMapEntry(mapCollection, trimmed);

    if (cached?.status === 'mapped' && cached.discogsId) {
      await cacheMappedResult(trimmed, {
        discogsId: cached.discogsId,
        discogsName: cached.discogsName ?? trimmed,
        matchScore: cached.matchScore,
        searchQuery: cached.searchQuery ?? `#mongo:${cached.discogsId}`,
      });
      return {
        status: 'mapped',
        discogsId: cached.discogsId,
        discogsName: cached.discogsName ?? trimmed,
        searchQuery: cached.searchQuery ?? `#cache:${cached.discogsId}`,
        matchScore: cached.matchScore,
        fromCache: true,
        cacheLayer: 'mongo',
      };
    }

    if (cached?.status === 'pending_review') {
      await cachePendingReview(trimmed, {
        reviewReason: cached.reviewReason ?? '待复核',
        searchQuery: cached.searchQuery,
      });
      return {
        status: 'pending_review',
        reviewReason: cached.reviewReason ?? '待复核',
        fromCache: true,
        cacheLayer: 'mongo',
      };
    }

    const forcedId = DISCOGS_LINEUP_ARTIST_IDS[trimmed.toUpperCase()];
    if (forcedId) {
      const searchQuery = `#forced:${forcedId}`;
      await upsertDjDiscogsMapMapped(mapCollection, {
        lineupName: trimmed,
        discogsId: forcedId,
        discogsName: trimmed,
        matchScore: 100,
        searchQuery,
      });
      await cacheMappedResult(trimmed, {
        discogsId: forcedId,
        discogsName: trimmed,
        matchScore: 100,
        searchQuery,
      });
      return {
        status: 'mapped',
        discogsId: forcedId,
        discogsName: trimmed,
        searchQuery,
        matchScore: 100,
        fromCache: false,
        forced: true,
      };
    }

    const { searchQuery, candidates } = await searchElectronicCandidates(trimmed);
    const scored = candidates.map((candidate) =>
      scoreDiscogsArtistCandidate(trimmed, candidate),
    );
    const decision = decideDiscogsArtistMatch(trimmed, scored, {
      minAcceptScore,
      ambiguityGap,
      searchQuery,
    });

    if (decision.status === 'pending_review') {
      await upsertDjDiscogsMapPendingReview(mapCollection, {
        lineupName: trimmed,
        searchQuery: decision.searchQuery,
        reviewReason: decision.reviewReason,
        candidateScores: decision.candidateScores.map((item) => ({
          discogsId: item.discogsId,
          name: item.name,
          total: item.total,
        })),
      });
      await cachePendingReview(trimmed, {
        reviewReason: decision.reviewReason,
        searchQuery: decision.searchQuery,
      });
      return {
        status: 'pending_review',
        reviewReason: decision.reviewReason,
        searchQuery: decision.searchQuery,
        fromCache: false,
      };
    }

    await upsertDjDiscogsMapMapped(mapCollection, {
      lineupName: trimmed,
      discogsId: decision.discogsId,
      discogsName: decision.discogsName,
      matchScore: decision.matchScore,
      searchQuery: decision.searchQuery,
      candidateScores: scored.map((item) => ({
        discogsId: item.discogsId,
        name: item.name,
        total: item.total,
      })),
    });
    await cacheMappedResult(trimmed, {
      discogsId: decision.discogsId,
      discogsName: decision.discogsName,
      matchScore: decision.matchScore,
      searchQuery: decision.searchQuery,
    });

    return {
      status: 'mapped',
      discogsId: decision.discogsId,
      discogsName: decision.discogsName,
      searchQuery: decision.searchQuery,
      matchScore: decision.matchScore,
      fromCache: false,
    };
  }

  return {
    resolveArtistMatch,
    searchElectronicCandidates,
  };
}
