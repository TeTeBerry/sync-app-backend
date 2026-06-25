/**
 * Lineup name → Discogs artist_id resolver.
 *
 * 1. Festival lineup English name
 * 2. dj_discogs_map (Mongo) — mapped hit → artist_id
 * 3. Miss → Discogs search (8 candidates) → score → write map
 * 4. With artist_id → GET /artists/{id} → profile 即简介 → upsert djs
 * 5. pending_review → map only, skip djs
 * 6. Never upsert djs without verifiable Discogs profile or release-derived styles
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISCOGS_LINEUP_ARTIST_IDS, getDiscogsSearchQueries } from './festival-lineup-fallback.mjs';
import {
  findDjDiscogsMapEntry,
  upsertDjDiscogsMapMapped,
  upsertDjDiscogsMapPendingReview,
} from './dj-discogs-map.mjs';
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
    pickTiebreakWinner,
    getEligibleRankedScores,
    getAmbiguousScoreCluster,
    DISCOGS_SEARCH_CANDIDATE_LIMIT,
    DISCOGS_MATCH_MIN_ACCEPT_SCORE,
    DISCOGS_MATCH_SUSPECT_MIN_SCORE,
    DISCOGS_MATCH_AMBIGUITY_GAP,
    DISCOGS_MATCH_RELEASE_SAMPLE_SIZE,
  } = loadMatchUtil();

  const minAcceptScore = Number(
    process.env.DISCOGS_MATCH_MIN_SCORE ?? DISCOGS_MATCH_MIN_ACCEPT_SCORE,
  );
  const suspectMinScore = Number(
    process.env.DISCOGS_MATCH_SUSPECT_MIN_SCORE ?? DISCOGS_MATCH_SUSPECT_MIN_SCORE,
  );
  const ambiguityGap = Number(
    process.env.DISCOGS_MATCH_AMBIGUITY_GAP ?? DISCOGS_MATCH_AMBIGUITY_GAP,
  );
  const candidateLimit = Number(
    process.env.DISCOGS_SEARCH_CANDIDATE_LIMIT ?? DISCOGS_SEARCH_CANDIDATE_LIMIT,
  );

  /** Artist detail for scoring; same payload reused for profile after a winner is chosen. */
  async function fetchArtistCandidate(artistId) {
    await delay(config.requestDelayMs);
    const artist = await discogsGet(`https://api.discogs.com/artists/${artistId}`);

    return {
      id: artist.id,
      name: artist.name,
      realName: artist.real_name ?? '',
      profile: artist.profile ?? '',
      genres: Array.isArray(artist.genres) ? artist.genres : [],
      styles: Array.isArray(artist.styles) ? artist.styles : [],
      country: artist.country ?? '',
      urls: artist.urls ?? [],
      members: Array.isArray(artist.members)
        ? artist.members.map((member) => member.name)
        : [],
      releaseSamples: [],
    };
  }

  /** First N releases for tie-break only — no Redis / djs cache. */
  async function fetchMatchReleaseSamples(artistId) {
    const samples = [];

    try {
      await delay(config.requestDelayMs);
      const list = await discogsGet(
        `https://api.discogs.com/artists/${artistId}/releases`,
        { per_page: String(DISCOGS_MATCH_RELEASE_SAMPLE_SIZE), page: '1' },
      );

      for (const item of (list.releases ?? []).slice(
        0,
        DISCOGS_MATCH_RELEASE_SAMPLE_SIZE,
      )) {
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
          const formatDescriptions = (release.formats ?? []).flatMap((format) => [
            format.name,
            ...(format.descriptions ?? []),
          ]);

          samples.push({
            genres: release.genres ?? [],
            styles: release.styles ?? [],
            title: (release.title ?? item.title ?? '').trim(),
            format: formatDescriptions.join(', '),
            formatDescriptions,
          });
        } catch (error) {
          console.warn('决胜读取发行失败', releaseUrl, error.message ?? error);
        }
      }
    } catch (error) {
      console.warn('决胜读取发行列表失败', artistId, error.message ?? error);
    }

    return samples;
  }

  async function enrichCandidatesForTiebreak(candidateById, scoredCluster) {
    for (const scored of scoredCluster) {
      const candidate = candidateById.get(scored.discogsId);
      if (!candidate) {
        continue;
      }
      if ((candidate.releaseSamples?.length ?? 0) >= DISCOGS_MATCH_RELEASE_SAMPLE_SIZE) {
        continue;
      }
      candidate.releaseSamples = await fetchMatchReleaseSamples(scored.discogsId);
    }
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

  async function resolveArtistMatch(lineupName, mapCollection) {
    const trimmed = lineupName.trim();

    const cached = await findDjDiscogsMapEntry(mapCollection, trimmed);

    if (cached?.status === 'mapped' && cached.discogsId) {
      return {
        status: 'mapped',
        discogsId: cached.discogsId,
        discogsName: cached.discogsName ?? trimmed,
        searchQuery: cached.searchQuery ?? `#map:${cached.discogsId}`,
        matchScore: cached.matchScore,
        fromCache: true,
        cacheLayer: 'mongo',
      };
    }

    if (cached?.status === 'pending_review') {
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
      try {
        await fetchArtistCandidate(forcedId);
      } catch (error) {
        const reviewReason = '强制 Discogs ID 不存在或不可访问';
        await upsertDjDiscogsMapPendingReview(mapCollection, {
          lineupName: trimmed,
          searchQuery,
          reviewReason,
        });
        return {
          status: 'pending_review',
          reviewReason,
          searchQuery,
          fromCache: false,
        };
      }

      await upsertDjDiscogsMapMapped(mapCollection, {
        lineupName: trimmed,
        discogsId: forcedId,
        discogsName: trimmed,
        matchScore: minAcceptScore,
        searchQuery,
      });
      return {
        status: 'mapped',
        discogsId: forcedId,
        discogsName: trimmed,
        searchQuery,
        matchScore: minAcceptScore,
        fromCache: false,
        forced: true,
      };
    }

    const { searchQuery, candidates } = await searchElectronicCandidates(trimmed);
    const candidateById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const scored = candidates.map((candidate) =>
      scoreDiscogsArtistCandidate(trimmed, candidate),
    );
    let decision = decideDiscogsArtistMatch(trimmed, scored, {
      minAcceptScore,
      suspectMinScore,
      ambiguityGap,
      searchQuery,
    });

    if (decision.status === 'pending_review' && decision.needsTiebreak) {
      const eligible = getEligibleRankedScores(scored, suspectMinScore);
      const cluster =
        decision.tiebreakCluster ??
        getAmbiguousScoreCluster(eligible, minAcceptScore, ambiguityGap);

      if (cluster.length >= 2) {
        await enrichCandidatesForTiebreak(candidateById, cluster);
        const clusterCandidates = cluster
          .map((item) => candidateById.get(item.discogsId))
          .filter((candidate) => candidate != null);
        const winner = pickTiebreakWinner(clusterCandidates);
        const leadScore = cluster[0];

        if (winner) {
          decision = {
            status: 'mapped',
            discogsId: winner.id,
            discogsName: winner.name,
            matchScore: leadScore.total,
            searchQuery,
          };
        } else {
          decision = {
            status: 'pending_review',
            reviewReason: `${cluster.length} 位高分接近，决胜后仍无法区分（${leadScore.total} 分）`,
            searchQuery,
            candidateScores: eligible,
          };
        }
      }
    }

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

    const winner = candidates.find((item) => item.id === decision.discogsId);
    return {
      status: 'mapped',
      discogsId: decision.discogsId,
      discogsName: decision.discogsName,
      searchQuery: decision.searchQuery,
      matchScore: decision.matchScore,
      fromCache: false,
      prefetchedArtist: winner,
    };
  }

  return {
    resolveArtistMatch,
    searchElectronicCandidates,
  };
}
