/**
 * Lineup name → Discogs artist_id resolver (v3).
 *
 * 1. Festival lineup English name
 * 2. dj_discogs_map (Mongo) — mapped hit → artist_id
 * 3. Miss → tiered database/search (genre=Electronic) → score → write map
 * 4. With artist_id → GET /artists/{id} → profile → upsert djs
 * 5. pending_review → map only, skip djs
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getDiscogsSearchQueries,
  getDiscogsTrustedNameVariants,
} from './festival-lineup-fallback.mjs';
import {
  DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
  formatMapCandidateScores,
} from './lineup-discogs-search.mjs';
import {
  findDjDiscogsMapEntry,
  upsertDjDiscogsMapMapped,
  upsertDjDiscogsMapPendingReview,
} from './dj-discogs-map.mjs';
import { isHermesWebOnlyMap } from './web-only-dj-profile.mjs';
import {
  getDiscogsSearchRedisCache,
  setDiscogsSearchRedisCache,
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

function pickBetterPendingDecision(current, next) {
  if (!next) {
    return current;
  }
  if (!current) {
    return next;
  }
  const currentTop = current.candidateScores?.[0]?.total ?? -1;
  const nextTop = next.candidateScores?.[0]?.total ?? -1;
  return nextTop > currentTop ? next : current;
}

export function createDiscogsArtistResolver(config, discogsGet, delay) {
  const {
    buildLineupSearchStrategies,
    buildLineupSearchRequestParams,
    artistRefsFromSearchHits,
    artistRefsFromRelease,
    filterArtistRefsByNameGate,
    mergeDiscogsArtistRefs,
    formatDiscogsArtistSearchLabel,
    scoreDiscogsArtistCandidate,
    decideDiscogsArtistMatch,
    pickTiebreakWinner,
    getEligibleRankedScores,
    getAmbiguousScoreCluster,
    isLineupDiscogsCandidatePlausible,
    isStaleDiscogsMapEntry,
    DISCOGS_REVIEW_REASON: MATCH_REVIEW_REASON,
    DISCOGS_SEARCH_CANDIDATE_LIMIT,
    DISCOGS_ARTIST_SEARCH_RESULT_SCAN_LIMIT,
    DISCOGS_RELEASE_SEARCH_PER_PAGE,
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
  const scanLimit = Math.max(
    candidateLimit,
    DISCOGS_ARTIST_SEARCH_RESULT_SCAN_LIMIT,
  );

  /** Artist detail for scoring; reused for profile after a winner is chosen. */
  async function fetchArtistCandidate(artistId, discoveryMeta) {
    await delay(config.requestDelayMs);
    const artist = await discogsGet(`https://api.discogs.com/artists/${artistId}`);

    return {
      id: artist.id,
      name: artist.name,
      realName: artist.real_name ?? '',
      profile: artist.profile ?? '',
      genres: Array.isArray(artist.genres) ? artist.genres : [],
      styles: Array.isArray(artist.styles) ? artist.styles : [],
      aliases: Array.isArray(artist.namevariations)
        ? artist.namevariations
        : [],
      country: artist.country ?? '',
      urls: artist.urls ?? [],
      members: Array.isArray(artist.members)
        ? artist.members.map((member) => member.name)
        : [],
      releaseSamples: [],
      discoveryMeta,
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

  async function discoverReleaseGraphRefs(strategy, lineupName, nameMatchVariants) {
    const strategyLabel = formatDiscogsArtistSearchLabel(strategy.params);
    const cached = await getDiscogsSearchRedisCache(strategyLabel);
    if (Array.isArray(cached)) {
      return cached;
    }

    await delay(config.requestDelayMs);
    const data = await discogsGet(
      'https://api.discogs.com/database/search',
      buildLineupSearchRequestParams(strategy, scanLimit),
    );

    const refs = [];
    for (const item of (data.results ?? []).slice(
      0,
      DISCOGS_RELEASE_SEARCH_PER_PAGE,
    )) {
      if (item.type !== 'release' || !item.id) {
        continue;
      }

      const releaseUrl =
        item.resource_url?.trim() ||
        `https://api.discogs.com/releases/${item.id}`;

      await delay(config.requestDelayMs);
      try {
        const release = await discogsGet(releaseUrl);
        refs.push(...artistRefsFromRelease(release, strategy));
      } catch (error) {
        console.warn('release 图读取失败', releaseUrl, error.message ?? error);
      }
    }

    const merged = mergeDiscogsArtistRefs(refs);
    const gated = filterArtistRefsByNameGate(
      merged,
      lineupName,
      nameMatchVariants,
    );
    await setDiscogsSearchRedisCache(strategyLabel, gated);
    return gated;
  }

  async function discoverArtistDirectRefs(
    strategy,
    lineupName,
    nameMatchVariants,
  ) {
    const strategyLabel = formatDiscogsArtistSearchLabel(strategy.params);
    const cached = await getDiscogsSearchRedisCache(strategyLabel);
    if (Array.isArray(cached)) {
      return cached;
    }

    await delay(config.requestDelayMs);
    const data = await discogsGet(
      'https://api.discogs.com/database/search',
      buildLineupSearchRequestParams(strategy, scanLimit),
    );

    const refs = artistRefsFromSearchHits(
      data.results ?? [],
      strategy,
      nameMatchVariants,
    );
    const gated = filterArtistRefsByNameGate(
      refs,
      lineupName,
      nameMatchVariants,
    );
    await setDiscogsSearchRedisCache(strategyLabel, gated);
    return gated;
  }

  async function discoverArtistRefs(strategy, lineupName, nameMatchVariants) {
    if (strategy.kind === 'release-graph') {
      return discoverReleaseGraphRefs(strategy, lineupName, nameMatchVariants);
    }
    return discoverArtistDirectRefs(strategy, lineupName, nameMatchVariants);
  }

  async function fetchCandidatesFromRefs(refs) {
    const candidates = [];
    for (const ref of refs.slice(0, candidateLimit)) {
      try {
        const candidate = await fetchArtistCandidate(ref.artistId, {
          strategyId: ref.strategyId,
          strategyLabel: ref.strategyLabel,
        });
        candidates.push(candidate);
      } catch (error) {
        console.warn('读取艺人候选失败', ref.artistId, error.message ?? error);
      }
    }
    return candidates;
  }

  function filterPlausibleCandidates(candidates, lineupName, nameMatchVariants) {
    return candidates.filter((candidate) =>
      isLineupDiscogsCandidatePlausible(
        lineupName,
        candidate,
        nameMatchVariants,
      ),
    );
  }

  async function tryStrategyMatch({
    strategy,
    queryName,
    lineupName,
    nameMatchVariants,
  }) {
    const refs = await discoverArtistRefs(strategy, lineupName, nameMatchVariants);
    if (!refs.length) {
      return null;
    }

    const searchQuery = formatDiscogsArtistSearchLabel(strategy.params);
    const rawCandidates = await fetchCandidatesFromRefs(refs);
    const candidates = filterPlausibleCandidates(
      rawCandidates,
      lineupName,
      nameMatchVariants,
    );
    if (!candidates.length) {
      return null;
    }

    if (strategy.kind === 'release-graph') {
      for (const candidate of candidates) {
        if ((candidate.releaseSamples?.length ?? 0) >= DISCOGS_MATCH_RELEASE_SAMPLE_SIZE) {
          continue;
        }
        candidate.releaseSamples = await fetchMatchReleaseSamples(candidate.id);
      }
    }

    const scored = candidates.map((candidate) =>
      scoreDiscogsArtistCandidate(lineupName, candidate),
    );
    const decision = decideDiscogsArtistMatch(lineupName, scored, {
      minAcceptScore,
      suspectMinScore,
      ambiguityGap,
      searchQuery,
      nameMatchVariants,
      candidateById: new Map(
        candidates.map((candidate) => [candidate.id, candidate]),
      ),
    });

    return {
      strategy,
      searchQuery,
      candidates,
      scored,
      decision,
    };
  }

  async function matchArtistFromDiscogs(trimmed) {
    const searchNames = getDiscogsSearchQueries(trimmed);
    const nameMatchVariants = getDiscogsTrustedNameVariants(trimmed);
    const queryNames = searchNames.length ? searchNames : [trimmed];

    let bestPending = null;
    let bestAttempt = null;

    for (const queryName of queryNames) {
      const strategies = buildLineupSearchStrategies(queryName);

      for (const strategy of strategies) {
        const attempt = await tryStrategyMatch({
          strategy,
          queryName,
          lineupName: trimmed,
          nameMatchVariants,
        });
        if (!attempt) {
          continue;
        }

        const {
          decision,
          candidates,
          scored,
          searchQuery,
          strategy: winningStrategy,
        } = attempt;

        const hasEligible = scored.some((item) => item.total >= suspectMinScore);
        if (!hasEligible) {
          continue;
        }

        bestAttempt = attempt;

        if (decision.status === 'mapped') {
          const winner = candidates.find(
            (item) => item.id === decision.discogsId,
          );
          return {
            status: 'mapped',
            discogsId: decision.discogsId,
            discogsName: decision.discogsName,
            searchQuery,
            discoveryStrategyId: winningStrategy.id,
            matchScore: decision.matchScore,
            candidateScores: formatMapCandidateScores(scored),
            prefetchedArtist: winner,
          };
        }

        if (decision.status === 'pending_review' && decision.needsTiebreak) {
          const candidateById = new Map(
            candidates.map((candidate) => [candidate.id, candidate]),
          );
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
              const mappedCandidate = isLineupDiscogsCandidatePlausible(
                trimmed,
                winner,
                nameMatchVariants,
              )
                ? {
                    status: 'mapped',
                    discogsId: winner.id,
                    discogsName: winner.name,
                    matchScore: leadScore.total,
                    searchQuery,
                    discoveryStrategyId: winningStrategy.id,
                  }
                : {
                    status: 'pending_review',
                    reviewReason: MATCH_REVIEW_REASON.nameMismatch(winner.name),
                    searchQuery,
                    candidateScores: eligible,
                  };

              if (mappedCandidate.status === 'mapped') {
                const winnerCandidate = candidates.find(
                  (item) => item.id === mappedCandidate.discogsId,
                );
                return {
                  ...mappedCandidate,
                  candidateScores: formatMapCandidateScores(scored),
                  prefetchedArtist: winnerCandidate,
                };
              }

              bestPending = pickBetterPendingDecision(
                bestPending,
                mappedCandidate,
              );
              continue;
            }
          }
        }

        bestPending = pickBetterPendingDecision(bestPending, decision);
      }
    }

    const fallbackDecision = bestPending ?? {
      status: 'pending_review',
      reviewReason: MATCH_REVIEW_REASON.NO_QUALIFYING_CANDIDATE,
      searchQuery:
        bestAttempt?.searchQuery ??
        formatDiscogsArtistSearchLabel(
          buildLineupSearchStrategies(queryNames[0] ?? trimmed)[0]?.params ?? {
            type: 'artist',
            artist: trimmed,
            genre: 'Electronic',
          },
        ),
      candidateScores: bestAttempt?.scored ?? [],
    };

    return {
      status: 'pending_review',
      reviewReason: fallbackDecision.reviewReason,
      searchQuery: fallbackDecision.searchQuery,
      candidateScores: formatMapCandidateScores(
        fallbackDecision.candidateScores ?? [],
      ),
    };
  }

  async function previewArtistMatch(lineupName) {
    const trimmed = lineupName?.trim();
    if (!trimmed) {
      return {
        status: 'pending_review',
        reviewReason: 'empty lineup name',
        searchQuery: '',
        candidateScores: [],
      };
    }
    return matchArtistFromDiscogs(trimmed);
  }

  async function resolveArtistMatch(lineupName, mapCollection) {
    const trimmed = lineupName.trim();

    const cached = await findDjDiscogsMapEntry(mapCollection, trimmed);

    if (cached?.status === 'mapped' && isHermesWebOnlyMap(cached)) {
      return {
        status: 'mapped',
        discogsId: cached.discogsId ?? null,
        discogsName: cached.discogsName ?? trimmed,
        searchQuery: cached.searchQuery ?? '#web-mapped',
        discoveryStrategyId: cached.discoveryStrategyId,
        fromCache: true,
        cacheLayer: 'mongo',
        webOnly: true,
        hermesEvidence: cached.hermesEvidence,
      };
    }

    if (cached?.status === 'mapped' && cached.discogsId) {
      if (!isStaleDiscogsMapEntry(cached)) {
        return {
          status: 'mapped',
          discogsId: cached.discogsId,
          discogsName: cached.discogsName ?? trimmed,
          searchQuery: cached.searchQuery ?? `#map:${cached.discogsId}`,
          discoveryStrategyId: cached.discoveryStrategyId,
          matchScore: cached.matchScore,
          fromCache: true,
          cacheLayer: 'mongo',
        };
      }
      console.warn(
        '↷ 忽略 stale map，重新 v3 匹配:',
        trimmed,
        cached.searchQuery ?? '',
      );
    }

    if (cached?.status === 'pending_review') {
      return {
        status: 'pending_review',
        reviewReason: cached.reviewReason ?? '待复核',
        fromCache: true,
        cacheLayer: 'mongo',
      };
    }

    const result = await matchArtistFromDiscogs(trimmed);

    if (result.status === 'mapped') {
      await upsertDjDiscogsMapMapped(mapCollection, {
        lineupName: trimmed,
        discogsId: result.discogsId,
        discogsName: result.discogsName,
        matchScore: result.matchScore,
        searchQuery: result.searchQuery,
        discoveryStrategyId: result.discoveryStrategyId,
        candidateScores: result.candidateScores ?? [],
        source: DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
      });

      return {
        status: 'mapped',
        discogsId: result.discogsId,
        discogsName: result.discogsName,
        searchQuery: result.searchQuery,
        discoveryStrategyId: result.discoveryStrategyId,
        matchScore: result.matchScore,
        fromCache: false,
        prefetchedArtist: result.prefetchedArtist,
      };
    }

    await upsertDjDiscogsMapPendingReview(mapCollection, {
      lineupName: trimmed,
      searchQuery: result.searchQuery,
      reviewReason: result.reviewReason,
      candidateScores: result.candidateScores ?? [],
      source: DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
    });
    return {
      status: 'pending_review',
      reviewReason: result.reviewReason,
      searchQuery: result.searchQuery,
      fromCache: false,
    };
  }

  async function searchDiscogsArtistCandidates(queryName, nameMatchVariants = []) {
    const variants = nameMatchVariants.length
      ? nameMatchVariants
      : [queryName];
    const strategies = buildLineupSearchStrategies(queryName);

    for (const strategy of strategies) {
      const refs = await discoverArtistRefs(strategy, queryName, variants);
      const candidates = await fetchCandidatesFromRefs(refs);
      const plausible = filterPlausibleCandidates(candidates, queryName, variants);
      if (plausible.length) {
        return {
          searchQuery: formatDiscogsArtistSearchLabel(strategy.params),
          discoveryStrategyId: strategy.id,
          candidates: plausible,
        };
      }
    }

    return {
      searchQuery: formatDiscogsArtistSearchLabel(
        strategies[0]?.params ?? {
          type: 'artist',
          artist: queryName,
          genre: 'Electronic',
        },
      ),
      discoveryStrategyId: strategies[0]?.id ?? 'artist-exact',
      candidates: [],
    };
  }

  return {
    resolveArtistMatch,
    previewArtistMatch,
    matchArtistFromDiscogs,
    searchDiscogsArtistCandidates,
  };
}
