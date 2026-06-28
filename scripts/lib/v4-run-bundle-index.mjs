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

export function resolveV4RunPathFromArgv(argv = process.argv) {
  const explicit = readArg(argv, '--v4-run');
  if (explicit) {
    return resolve(explicit);
  }
  const runsDir = readArg(argv, '--runs-dir') || defaultHermesRunsDir;
  return resolveLatestV4RunJsonPath(runsDir);
}
