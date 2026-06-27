import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expandRealSoloArtistTargets } from './lineup-real-artist-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = join(__dirname, '..', '..');
const defaultHermesRunsDir = join(backendRoot, '..', 'hermes-agent', 'runs');

function readArg(argv, flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return argv[index + 1]?.trim() ?? '';
}

export function resolveLatestV4RunJsonPath(runsDir = defaultHermesRunsDir) {
  if (!existsSync(runsDir)) {
    return null;
  }

  const candidates = readdirSync(runsDir)
    .filter((name) => /^v4-.*\.json$/i.test(name))
    .map((name) => join(runsDir, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);

  return candidates[0] ?? null;
}

export function loadV4RunBundles(jsonPath) {
  const absolutePath = resolve(jsonPath);
  if (!existsSync(absolutePath)) {
    throw new Error(`v4 run JSON not found: ${absolutePath}`);
  }

  const payload = JSON.parse(readFileSync(absolutePath, 'utf8'));
  const bundles = payload.bundles ?? [];

  return {
    path: absolutePath,
    runId: payload.runId ?? null,
    finishedAt: payload.finishedAt ?? null,
    bundles,
    bundleByUpper: new Map(
      bundles.map((bundle) => [bundle.lineupName?.trim().toUpperCase(), bundle]),
    ),
    displayNames: bundles
      .map((bundle) => bundle.lineupName?.trim())
      .filter(Boolean),
  };
}

export function findV4BundleForLineupName(lineupName, v4Index) {
  const upper = lineupName.trim().toUpperCase();
  if (!upper) {
    return { bundle: null, matchedVia: null };
  }

  const exact = v4Index.bundleByUpper.get(upper);
  if (exact) {
    return { bundle: exact, matchedVia: 'exact' };
  }

  for (const bundle of v4Index.bundles) {
    const display = bundle.lineupName?.trim();
    if (!display) {
      continue;
    }
    const soloTargets = expandRealSoloArtistTargets(display);
    if (soloTargets.some((solo) => solo.toUpperCase() === upper)) {
      return { bundle, matchedVia: 'expanded_from_display', sourceDisplay: display };
    }
  }

  return { bundle: null, matchedVia: null };
}

function profileSnippet(bundle) {
  const text =
    bundle.discogs?.profile?.trim() ||
    bundle.hermesEvidence?.integratedReport?.trim() ||
    bundle.rationale?.trim() ||
    '';
  return text.replace(/\s+/g, ' ').slice(0, 160);
}

function buildCrawlAction(lineupName) {
  return `npm run db:crawl-catalog-artists -- --names "${lineupName.replace(/"/g, '\\"')}"`;
}

export function buildV4QuickConfirmRecord({
  missingArtist,
  bundle,
  matchedVia,
  sourceDisplay,
  v4Run,
}) {
  const discogsId = bundle.discogs?.id ?? null;
  const discogsName = bundle.discogs?.name?.trim() ?? null;
  const decision = bundle.decision ?? null;
  const confidence = bundle.confidence ?? null;

  let landingGap = 'v4_candidate_not_landed';
  if (missingArtist.issue === 'manual_stub') {
    landingGap = 'manual_stub_blocked_v4_candidate';
  } else if (missingArtist.issue === 'pending_review') {
    landingGap = 'pending_review_not_crawled';
  } else if (missingArtist.issue === 'mapped_no_real_profile') {
    landingGap = 'mapped_empty_profile';
  }

  return {
    lineupName: missingArtist.lineupName,
    issue: missingArtist.issue,
    landingGap,
    matchedVia,
    sourceDisplay: sourceDisplay ?? null,
    v4RunId: v4Run.runId,
    v4FinishedAt: v4Run.finishedAt,
    v4Decision: decision,
    v4Confidence: confidence,
    v4DiscogsId: discogsId,
    v4DiscogsName: discogsName,
    v4DiscogsUrl: discogsId
      ? `https://www.discogs.com/artist/${discogsId}`
      : null,
    profileSnippet: profileSnippet(bundle),
    action:
      missingArtist.issue === 'manual_stub'
        ? `delete manual-stub → ${buildCrawlAction(missingArtist.lineupName)}`
        : buildCrawlAction(missingArtist.lineupName),
  };
}

export function collectV4QuickConfirmArtists({
  missingArtists,
  v4RunPath,
  runsDir = defaultHermesRunsDir,
}) {
  const jsonPath = v4RunPath ?? resolveLatestV4RunJsonPath(runsDir);
  if (!jsonPath) {
    throw new Error(
      `No v4 run JSON found under ${runsDir}. Pass --v4-run /path/to/v4-*.json`,
    );
  }

  const v4Run = loadV4RunBundles(jsonPath);
  const quickConfirm = [];
  const v4WebOnly = [];
  const noV4Match = [];

  for (const missingArtist of missingArtists) {
    const { bundle, matchedVia, sourceDisplay } = findV4BundleForLineupName(
      missingArtist.lineupName,
      v4Run,
    );

    if (!bundle) {
      noV4Match.push(missingArtist);
      continue;
    }

    if (bundle.discogs?.id) {
      if (bundle.decision === 'pending_review' || bundle.decision === 'mapped') {
        quickConfirm.push(
          buildV4QuickConfirmRecord({
            missingArtist,
            bundle,
            matchedVia,
            sourceDisplay,
            v4Run,
          }),
        );
        continue;
      }
    }

    if (bundle.decision === 'mapped' && !bundle.discogs?.id) {
      v4WebOnly.push({
        lineupName: missingArtist.lineupName,
        issue: missingArtist.issue,
        v4Decision: bundle.decision,
        v4Confidence: bundle.confidence ?? null,
        action: 'npm run db:rebuild-web-only-djs（web-only mapped）',
      });
      continue;
    }

    if (bundle.decision === 'no_match') {
      noV4Match.push({
        ...missingArtist,
        v4Decision: 'no_match',
      });
      continue;
    }

    noV4Match.push(missingArtist);
  }

  return {
    v4RunPath: v4Run.path,
    v4RunId: v4Run.runId,
    v4FinishedAt: v4Run.finishedAt,
    quickConfirm,
    v4WebOnly,
    noV4Match,
  };
}

export function resolveV4RunPathFromArgv(argv = process.argv) {
  const explicit = readArg(argv, '--v4-run');
  if (explicit) {
    return resolve(explicit);
  }
  const runsDir = readArg(argv, '--runs-dir') || defaultHermesRunsDir;
  return resolveLatestV4RunJsonPath(runsDir);
}
