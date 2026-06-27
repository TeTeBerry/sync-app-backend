#!/usr/bin/env node
/**
 * Remove all manual-stub dj_discogs_map rows and their synthetic djs records.
 *
 * Usage:
 *   npm run db:purge-manual-stub-maps
 *   npm run db:purge-manual-stub-maps:dry-run
 *   npm run db:purge-manual-stub-maps -- --json
 */

import mongoose from 'mongoose';
import { purgeAllManualStubMaps } from './lib/apply-v4-pending-landings.mjs';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDjDiscogsMapModel,
  createDjModel,
  getCrawlConfig,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const asJson = argv.includes('--json');

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const mapCol = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);

  const purged = await purgeAllManualStubMaps({
    mapCollection: mapCol,
    Dj,
    dryRun,
  });

  if (!dryRun) {
    await bumpDjCatalogCacheVersion();
  }

  await closeDjDiscogsRedisCache();
  await mongoose.disconnect();

  const payload = {
    generatedAt: new Date().toISOString(),
    dryRun,
    purgedCount: purged.length,
    purged,
  };

  if (asJson) {
    console.log(JSON.stringify(payload));
    return;
  }

  console.log(
    `\n${dryRun ? 'DRY-RUN ' : ''}清除 manual-stub: ${payload.purgedCount} 位`,
  );
  for (const name of purged) {
    console.log(`- ${name}`);
  }
}

main().catch(async (error) => {
  console.error('❌ purge-manual-stub-maps failed:', error.message ?? error);
  try {
    await closeDjDiscogsRedisCache();
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
