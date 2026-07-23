#!/usr/bin/env node
/**
 * Upsert curated `djs` rows and promote pending_review maps to mapped.
 *
 * Usage:
 *   npm run db:patch-curated-dj-catalog:dry-run
 *   npm run db:patch-curated-dj-catalog
 *   npm run db:patch-curated-dj-catalog -- --pending-only
 *   npm run db:patch-curated-dj-catalog -- --weak-style-only
 *
 * Festival lineup artist styles (808, Ultra Japan, etc.) are stored in MongoDB only.
 * Fresh environments should sync via `db:pull-lineup-artist-catalog-from-cloud`.
 */
import mongoose from 'mongoose';
import { CURATED_MISSING_DJ_CATALOG } from './data/curated-missing-dj-catalog.mjs';
import { CURATED_PENDING_DJ_CATALOG } from './data/curated-pending-dj-catalog.mjs';
import { CURATED_WEAK_STYLE_DJ_CATALOG } from './data/curated-weak-style-dj-catalog.mjs';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDjModel,
  getCrawlConfig,
  loadDotEnv,
  upsertDjRecord,
} from './lib/discogs-crawl.mjs';
import {
  createDjDiscogsMapModel,
  upsertDjDiscogsMapMapped,
} from './lib/dj-discogs-map.mjs';
import {
  allocateSyntheticDiscogsId,
  isSyntheticDiscogsId,
} from './lib/web-only-dj-profile.mjs';

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const pendingOnly = argv.includes('--pending-only');
const missingOnly = argv.includes('--missing-only');
const weakStyleOnly = argv.includes('--weak-style-only');
const keysArgIndex = argv.indexOf('--keys');

const CURATED_SOURCE = 'manual-curated';

function filterEntriesByKeys(entries) {
  if (keysArgIndex < 0) {
    return entries;
  }
  const keys = (argv[keysArgIndex + 1] ?? '')
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
  if (!keys.length) {
    return entries;
  }
  const allowed = new Set(keys);
  return Object.fromEntries(
    Object.entries(entries).filter(([key]) => allowed.has(key)),
  );
}

function resolveCatalogBatches() {
  const batches = [];
  if (weakStyleOnly) {
    batches.push({
      label: 'weak-style',
      entries: filterEntriesByKeys(CURATED_WEAK_STYLE_DJ_CATALOG),
    });
    return batches;
  }
  if (!pendingOnly) {
    batches.push({
      label: 'missing-djs',
      entries: filterEntriesByKeys(CURATED_MISSING_DJ_CATALOG),
    });
  }
  if (!missingOnly) {
    batches.push({
      label: 'pending-review',
      entries: filterEntriesByKeys(CURATED_PENDING_DJ_CATALOG),
    });
  }
  return batches;
}

function resolveDiscogsId(lineupName, mapRow, curated) {
  if (curated.useSyntheticDiscogsId) {
    return allocateSyntheticDiscogsId(lineupName);
  }
  if (curated.discogsId) {
    return curated.discogsId;
  }
  if (mapRow?.discogsId && !curated.ignoreMapDiscogsId) {
    return mapRow.discogsId;
  }
  return allocateSyntheticDiscogsId(lineupName);
}

async function applyCuratedEntry({
  Dj,
  mapCollection,
  lineupNameKey,
  curated,
  mapRow,
  dryRun: isDryRun,
}) {
  const lineupName =
    curated.lineupName?.trim() || mapRow?.lineupName?.trim() || lineupNameKey;
  const discogsId = resolveDiscogsId(lineupName, mapRow, curated);
  const discogsName =
    curated.discogsName?.trim() ||
    mapRow?.discogsName?.trim() ||
    lineupName;
  const genres = curated.genres ?? [];
  const styles = curated.styles?.length ? curated.styles : genres;

  const record = {
    discogsId,
    name: discogsName,
    realName: curated.realName ?? '',
    profile: curated.profile?.trim() ?? '',
    genres,
    styles,
    country: curated.country?.trim() ?? '',
    urls: curated.urls ?? [],
    members: curated.members ?? [],
    representativeWorks: curated.representativeWorks ?? [],
    crawledAt: new Date(),
  };

  const synthetic = isSyntheticDiscogsId(discogsId);
  console.log(
    `${isDryRun ? '[dry-run] ' : ''}${lineupName} → #${discogsId}` +
      `${synthetic ? ' (synthetic)' : ''} styles=${styles.join(', ')}`,
  );

  if (isDryRun) {
    return;
  }

  await upsertDjRecord(Dj, record);
  await upsertDjDiscogsMapMapped(mapCollection, {
    lineupName,
    discogsId,
    discogsName,
    matchScore: 100,
    searchQuery: '#manual-curated',
    discoveryStrategyId: 'curated-pending',
    source: CURATED_SOURCE,
    candidateScores: [],
  });
  await mapCollection.updateOne(
    { lineupNameKey },
    {
      $set: {
        displayGenres: genres,
        displayStyles: styles,
      },
    },
  );
}

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const Dj = createDjModel(mongoose);
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;

  let updated = 0;
  let skipped = 0;

  for (const batch of resolveCatalogBatches()) {
    console.log(`\n── ${batch.label} ──`);
    for (const [lineupNameKey, curated] of Object.entries(batch.entries)) {
      let mapRow = await mapCollection.findOne({ lineupNameKey });
      if (!mapRow) {
        const lineupName = curated.lineupName?.trim() || lineupNameKey;
        console.warn(`⚠️  ${lineupNameKey}：map 不存在，将新建`);
        if (!dryRun) {
          await upsertDjDiscogsMapMapped(mapCollection, {
            lineupName,
            discogsId: null,
            discogsName: lineupName,
            matchScore: 0,
            searchQuery: '#manual-curated-bootstrap',
            discoveryStrategyId: 'curated-weak-style',
            source: CURATED_SOURCE,
            candidateScores: [],
          });
          mapRow = await mapCollection.findOne({ lineupNameKey });
        }
      }

      if (!mapRow && dryRun) {
        console.log(`${dryRun ? '[dry-run] ' : ''}would bootstrap map for ${lineupNameKey}`);
        updated += 1;
        continue;
      }

      if (!mapRow) {
        console.warn(`⚠️  跳过 ${lineupNameKey}：map 仍不存在`);
        skipped += 1;
        continue;
      }

      await applyCuratedEntry({
        Dj,
        mapCollection,
        lineupNameKey,
        curated,
        mapRow,
        dryRun,
      });
      updated += 1;
    }
  }

  if (!dryRun && updated > 0) {
    await bumpDjCatalogCacheVersion();
  }

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log(`\nDone. ${updated} patched, ${skipped} skipped.`);
}

main().catch(async (error) => {
  console.error('❌ patch-curated-dj-catalog failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore
  }
  process.exit(1);
});
