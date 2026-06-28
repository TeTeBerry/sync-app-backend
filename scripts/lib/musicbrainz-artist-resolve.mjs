/**
 * v3 MusicBrainz deterministic match (after Discogs miss / thin profile).
 *
 * Flow mirrors discogs-artist-resolve:
 * 1. dj_discogs_map cache (mapped musicbrainz-* / hermes web) → reuse
 * 2. MusicBrainz search + score gate → plan landing
 * 3. Discogs url-relation path OR mb web-only → write map + djs
 */
import { findDjDiscogsMapEntry } from './dj-discogs-map.mjs';
import {
  applyMusicBrainzLanding,
  planMusicBrainzLanding,
} from './apply-musicbrainz-landing.mjs';
import { hasMappedRealArtistData } from './lineup-real-artist-catalog.mjs';
import { isProtectedLineupMapSource } from './lineup-map-source.mjs';
import {
  isLineupMbRejected,
  PREFERRED_MB_BY_LINEUP,
} from './lineup-rejected-discogs.mjs';
import {
  createMusicBrainzClient,
  lineupNameMatchesMbArtist,
} from './musicbrainz-client.mjs';
import {
  classifyMbMatch,
  isMbMatchClassLandable,
  searchLineupArtistOnMusicBrainz,
  summarizeMbArtist,
} from './musicbrainz-lineup-lookup.mjs';
import { isHermesWebOnlyMap } from './web-only-dj-profile.mjs';

export { createMusicBrainzClient };

export function pickMbArtistHitForLineup(lineupName, hits) {
  if (!hits?.length) {
    return null;
  }

  const upper = lineupName.trim().toUpperCase();
  const preferred = PREFERRED_MB_BY_LINEUP[upper];

  const eligible = hits.filter((hit) => {
    if (isLineupMbRejected(lineupName, hit.id)) {
      return false;
    }
    return lineupNameMatchesMbArtist(lineupName, hit);
  });

  if (!eligible.length) {
    return null;
  }

  if (preferred) {
    const preferredHit = eligible.find((hit) => hit.id === preferred.mbid);
    if (preferredHit) {
      return preferredHit;
    }
  }

  return eligible.sort(
    (a, b) => Number(b.score ?? 0) - Number(a.score ?? 0),
  )[0];
}

export async function lookupLineupArtistOnMusicBrainz(mb, lineupName) {
  const upper = lineupName.trim().toUpperCase();
  const preferred = PREFERRED_MB_BY_LINEUP[upper];

  if (preferred?.mbid) {
    try {
      const detail = await mb.lookupArtist(preferred.mbid, {
        inc: 'aliases+tags+url-rels',
      });
      const topDetail = summarizeMbArtist({ ...detail, score: 100 });
      if (!isLineupMbRejected(lineupName, topDetail.mbid)) {
        return {
          lineupName,
          searchQueries: [`mbid:${preferred.mbid}`],
          usedQuery: preferred.mbid,
          matchClass: 'strong_match',
          hitCount: 1,
          topHits: [topDetail],
          topDetail,
          preferredMb: true,
        };
      }
    } catch (error) {
      console.warn(
        `↷ MB preferred lookup failed for ${lineupName}:`,
        error.message ?? error,
      );
    }
  }

  const variants = await searchLineupArtistOnMusicBrainz(mb, lineupName);
  const picked = pickMbArtistHitForLineup(lineupName, variants.topHits ?? []);

  if (!picked) {
    return {
      ...variants,
      matchClass: variants.hitCount ? 'weak_match' : 'no_match',
      topDetail: null,
    };
  }

  const matchClass = classifyMbMatch(lineupName, [picked]);
  let topDetail = summarizeMbArtist(picked);

  if (isMbMatchClassLandable(matchClass, 'strong')) {
    try {
      const detail = await mb.lookupArtist(picked.id, {
        inc: 'aliases+tags+url-rels',
      });
      topDetail = summarizeMbArtist({ ...detail, score: picked.score });
    } catch (error) {
      topDetail = {
        ...topDetail,
        lookupError: error.message ?? String(error),
      };
    }
  }

  if (topDetail?.mbid && isLineupMbRejected(lineupName, topDetail.mbid)) {
    return {
      ...variants,
      matchClass: 'no_match',
      topDetail: null,
      rejectedMbid: topDetail.mbid,
    };
  }

  return {
    ...variants,
    matchClass,
    topDetail,
  };
}

export function shouldTryMusicBrainzForMapRow(mapRow, dj) {
  if (!mapRow) {
    return true;
  }

  if (mapRow.status === 'mapped') {
    if (isProtectedLineupMapSource(mapRow.source) || isHermesWebOnlyMap(mapRow)) {
      return false;
    }
    if (hasMappedRealArtistData(mapRow, dj)) {
      return false;
    }
    return true;
  }

  if (mapRow.status === 'pending_review') {
    return true;
  }

  return false;
}

/**
 * Attempt MusicBrainz match + landing for one lineup name.
 * Returns { status: 'mapped'|'skipped'|'pending', ... }
 */
export async function resolveMusicBrainzArtistMatch({
  lineupName,
  mapCollection,
  Dj,
  discogs,
  discogsToken,
  musicBrainz,
  minMatch = 'strong',
  allowWebOnly = true,
  verify = true,
  dryRun = false,
  djById,
}) {
  const trimmed = lineupName.trim();
  const cached = await findDjDiscogsMapEntry(mapCollection, trimmed);
  const dj =
    djById?.get(cached?.discogsId) ??
    (cached?.discogsId
      ? await Dj.findOne({ discogsId: cached.discogsId }).lean()
      : null);

  if (!shouldTryMusicBrainzForMapRow(cached, dj)) {
    return {
      status: 'skipped',
      reason: 'already_has_profile',
      fromCache: true,
    };
  }

  if (
    cached?.status === 'mapped' &&
    (cached.source === 'musicbrainz-web' || cached.source === 'musicbrainz-discogs')
  ) {
    if (hasMappedRealArtistData(cached, dj)) {
      return {
        status: 'mapped',
        fromCache: true,
        cacheLayer: 'mongo',
        discogsId: cached.discogsId,
        discogsName: cached.discogsName,
        source: cached.source,
      };
    }
  }

  const lookup = await lookupLineupArtistOnMusicBrainz(musicBrainz, trimmed);
  const plan = planMusicBrainzLanding({
    lineupName: trimmed,
    lookup,
    minMatch,
    allowWebOnly,
  });

  if (plan.action === 'skip') {
    return {
      status: 'pending',
      reason: plan.reason ?? lookup.matchClass,
      matchClass: lookup.matchClass,
    };
  }

  const result = await applyMusicBrainzLanding({
    plan,
    mapCollection,
    Dj,
    discogs,
    discogsToken,
    verify,
    dryRun,
  });

  if (result.status === 'applied') {
    return {
      status: 'mapped',
      landing: result.landing,
      discogsId: result.discogsId ?? plan.discogsId,
      discogsName: result.discogsName ?? plan.detail?.name,
      matchClass: plan.matchClass,
      fromCache: false,
    };
  }

  return {
    status: 'pending',
    reason: result.reason ?? result.status,
    matchClass: plan.matchClass,
  };
}

/**
 * Batch MusicBrainz fallback (v3b) — same batching contract as crawlArtistNames.
 */
export async function crawlMusicBrainzArtistNames({
  artistNames,
  mapCollection,
  Dj,
  discogs,
  discogsToken,
  musicBrainz = createMusicBrainzClient(),
  label = '艺人',
  minMatch = 'strong',
  allowWebOnly = true,
  verify = true,
  dryRun = false,
}) {
  let applied = 0;
  let appliedDiscogs = 0;
  let appliedMbWeb = 0;
  let skipped = 0;
  let pending = 0;
  let failed = 0;

  const djs = await Dj.find({}).lean();
  const djById = new Map(djs.map((row) => [row.discogsId, row]));

  for (const artistName of artistNames) {
    console.log(`\n🎵 MB ${label}:`, artistName);

    try {
      const result = await resolveMusicBrainzArtistMatch({
        lineupName: artistName,
        mapCollection,
        Dj,
        discogs,
        discogsToken,
        musicBrainz,
        minMatch,
        allowWebOnly,
        verify,
        dryRun,
        djById,
      });

      if (result.status === 'mapped') {
        if (result.fromCache) {
          skipped += 1;
          console.log(
            `↷ 已有 MB/资料档案 #${result.discogsId ?? '—'} (${result.discogsName ?? artistName})`,
          );
        } else {
          applied += 1;
          if (result.landing === 'discogs') {
            appliedDiscogs += 1;
          } else {
            appliedMbWeb += 1;
          }
          console.log(
            `→ MB ${result.landing} #${result.discogsId ?? '—'} (${result.discogsName ?? artistName})`,
          );
        }
        continue;
      }

      if (result.status === 'skipped') {
        skipped += 1;
        console.log(`↷ 跳过: ${result.reason}`);
        continue;
      }

      pending += 1;
      console.warn(`⏸  MB 未落地: ${artistName} — ${result.reason ?? 'pending'}`);
    } catch (error) {
      failed += 1;
      console.error('MB 失败', artistName, error.message ?? error);
    }
  }

  return { applied, appliedDiscogs, appliedMbWeb, skipped, pending, failed };
}
