/**
 * Verify a proposed lineup → Discogs mapping using v3 scorer + name gate.
 * Used by Hermes v4 before writing dj_discogs_map.
 */
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { getDiscogsTrustedNameVariants } from './festival-lineup-fallback.mjs';
import { createDiscogsClient, getCrawlConfig } from './discogs-crawl.mjs';
import { resolveDistRoot, requireFromDist } from './resolve-dist-root.mjs';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

function ensureDistBuilt() {
  if (resolveDistRoot()) {
    return;
  }
  console.log('dist missing — building for Discogs verify…');
  execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
}

function loadMatchUtil() {
  ensureDistBuilt();
  return requireFromDist('modules/dj/discogs-artist-match.util');
}

async function fetchReleaseSamples(discogsGet, discogsId, sampleSize) {
  const samples = [];

  try {
    const list = await discogsGet(
      `https://api.discogs.com/artists/${discogsId}/releases`,
      { per_page: String(sampleSize), page: '1' },
    );

    for (const item of (list.releases ?? []).slice(0, sampleSize)) {
      const releaseId = item.main_release ?? item.id;
      const releaseUrl =
        item.resource_url?.trim() ||
        (releaseId ? `https://api.discogs.com/releases/${releaseId}` : '');
      if (!releaseUrl) {
        continue;
      }

      try {
        const release = await discogsGet(releaseUrl);
        samples.push({
          genres: release.genres ?? [],
          styles: release.styles ?? [],
        });
      } catch {
        // skip failed release fetch
      }
    }
  } catch {
    // releases list optional for verify
  }

  return samples;
}

/**
 * @param {{ lineupName: string; discogsId: number; discogsToken?: string }} input
 * @returns {Promise<{
 *   accepted: boolean;
 *   matchScore: number;
 *   discogsName: string;
 *   decision: string;
 *   reviewReason?: string;
 * }>}
 */
export async function verifyLineupDiscogsMatch({
  lineupName,
  discogsId,
  discogsToken,
}) {
  const trimmed = lineupName?.trim();
  if (!trimmed) {
    return {
      accepted: false,
      matchScore: 0,
      discogsName: '',
      decision: 'pending_review',
      reviewReason: 'empty lineup name',
    };
  }

  if (!Number.isFinite(discogsId) || discogsId <= 0) {
    return {
      accepted: false,
      matchScore: 0,
      discogsName: '',
      decision: 'pending_review',
      reviewReason: 'invalid discogsId',
    };
  }

  const config = getCrawlConfig();
  if (discogsToken?.trim()) {
    config.discogsToken = discogsToken.trim();
  }
  if (!config.discogsToken) {
    throw new Error('DISCOGS_TOKEN is required for verify');
  }

  const {
    scoreDiscogsArtistCandidate,
    decideDiscogsArtistMatch,
    DISCOGS_MATCH_RELEASE_SAMPLE_SIZE,
  } = loadMatchUtil();

  const { discogsGet } = createDiscogsClient(config);

  let artist;
  try {
    artist = await discogsGet(`https://api.discogs.com/artists/${discogsId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      accepted: false,
      matchScore: 0,
      discogsName: '',
      decision: 'pending_review',
      reviewReason: `Discogs artist fetch failed: ${message}`,
    };
  }

  const releaseSamples = await fetchReleaseSamples(
    discogsGet,
    discogsId,
    DISCOGS_MATCH_RELEASE_SAMPLE_SIZE,
  );

  const candidate = {
    id: artist.id,
    name: artist.name,
    profile: artist.profile ?? '',
    genres: Array.isArray(artist.genres) ? artist.genres : [],
    styles: Array.isArray(artist.styles) ? artist.styles : [],
    aliases: Array.isArray(artist.namevariations) ? artist.namevariations : [],
    releaseSamples,
  };

  const nameMatchVariants = getDiscogsTrustedNameVariants(trimmed);
  const scored = scoreDiscogsArtistCandidate(trimmed, candidate);
  const candidateById = new Map([[candidate.id, candidate]]);
  const decision = decideDiscogsArtistMatch(trimmed, [scored], {
    nameMatchVariants,
    candidateById,
    searchQuery: `hermes-verify:#${discogsId}`,
  });

  const accepted =
    decision.status === 'mapped' && decision.discogsId === discogsId;

  return {
    accepted,
    matchScore: scored.total,
    discogsName: candidate.name,
    decision: decision.status,
    reviewReason:
      decision.status === 'pending_review'
        ? decision.reviewReason
        : accepted
          ? undefined
          : `v3 scorer rejected (score=${scored.total})`,
  };
}

function parseArgs(argv) {
  let lineupName;
  let discogsId;
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--name' && argv[i + 1]) {
      lineupName = argv[i + 1];
      i += 1;
      continue;
    }
    if (argv[i] === '--discogs-id' && argv[i + 1]) {
      discogsId = Number(argv[i + 1]);
      i += 1;
    }
  }
  return { lineupName, discogsId };
}

const isMain =
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  const { lineupName, discogsId } = parseArgs(process.argv.slice(2));
  if (!lineupName || !Number.isFinite(discogsId)) {
    console.error(
      'Usage: node verify-lineup-discogs-match.mjs --name "ARTIST" --discogs-id 123',
    );
    process.exit(1);
  }

  verifyLineupDiscogsMatch({ lineupName, discogsId })
    .then((result) => {
      console.log(JSON.stringify(result));
      process.exit(result.accepted ? 0 : 2);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
