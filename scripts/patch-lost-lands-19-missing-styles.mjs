#!/usr/bin/env node
/**
 * Patch curated styles for Lost Lands 2026 artists still missing genre labels.
 *
 * Usage:
 *   npm run db:patch-lost-lands-19-missing-styles:dry-run
 *   npm run db:patch-lost-lands-19-missing-styles
 */
import mongoose from 'mongoose';
import { CURATED_LOST_LANDS_19_MISSING_STYLES } from './data/curated-lost-lands-19-missing-styles.mjs';
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

const dryRun = process.argv.includes('--dry-run');
const CURATED_SOURCE = 'manual-curated';

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
}) {
  const lineupName =
    curated.lineupName?.trim() || mapRow?.lineupName?.trim() || lineupNameKey;
  const discogsId = resolveDiscogsId(lineupName, mapRow, curated);
  const discogsName =
    curated.discogsName?.trim() || mapRow?.discogsName?.trim() || lineupName;
  const genres = curated.genres ?? [];
  const styles = curated.styles?.length ? curated.styles : genres;

  const record = {
    discogsId,
    name: discogsName,
    realName: curated.realName ?? '',
    profile: curated.profile?.trim() ?? mapRow?.hermesEvidence?.integratedReport?.slice(0, 600) ?? '',
    genres,
    styles,
    country: curated.country?.trim() ?? '',
    urls: curated.urls ?? [],
    members: curated.members ?? [],
    representativeWorks: curated.representativeWorks ?? [],
    crawledAt: new Date(),
  };

  console.log(
    `${dryRun ? '[dry-run] ' : ''}${lineupName} → #${discogsId}` +
      `${isSyntheticDiscogsId(discogsId) ? ' (synthetic)' : ''} styles=${styles.join(', ')}`,
  );

  if (dryRun) {
    return;
  }

  await upsertDjRecord(Dj, record);
  await upsertDjDiscogsMapMapped(mapCollection, {
    lineupName,
    discogsId,
    discogsName,
    matchScore: 100,
    searchQuery: '#lost-lands-19-curated',
    discoveryStrategyId: 'curated-weak-style',
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

  console.log(
    `\n── Lost Lands #19 missing styles (${Object.keys(CURATED_LOST_LANDS_19_MISSING_STYLES).length} entries) ──`,
  );

  for (const [lineupNameKey, curated] of Object.entries(
    CURATED_LOST_LANDS_19_MISSING_STYLES,
  )) {
    const mapRow = await mapCollection.findOne({ lineupNameKey });
    if (!mapRow) {
      console.warn(`⚠️  跳过 ${lineupNameKey}：map 不存在`);
      skipped += 1;
      continue;
    }

    await applyCuratedEntry({
      Dj,
      mapCollection,
      lineupNameKey,
      curated,
      mapRow,
    });
    updated += 1;
  }

  if (!dryRun && updated > 0) {
    await bumpDjCatalogCacheVersion();
  }

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log(`\nDone. ${updated} patched, ${skipped} skipped.`);
}

main().catch(async (error) => {
  console.error('❌ patch-lost-lands-19-missing-styles failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore
  }
  process.exit(1);
});
