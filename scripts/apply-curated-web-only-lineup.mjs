#!/usr/bin/env node
/**
 * Apply curated web-only profile for lineups with no acceptable Discogs page.
 *
 * Usage:
 *   npm run db:apply-curated-web-only-lineup -- --names "AN!KA"
 *   npm run db:apply-curated-web-only-lineup:dry-run -- --names "AN!KA"
 */

import mongoose from 'mongoose';
import { applyCuratedWebOnlyLineup } from './lib/apply-v4-pending-landings.mjs';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDjModel,
  getCrawlConfig,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { REJECTED_DISCOGS_BY_LINEUP } from './lib/lineup-rejected-discogs.mjs';

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

function readNamesArg() {
  const index = argv.indexOf('--names');
  if (index === -1) {
    return [];
  }
  return (argv[index + 1] ?? '')
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

async function main() {
  const names = readNamesArg();
  if (!names.length) {
    throw new Error('Usage: --names "ARTIST1,ARTIST2"');
  }

  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const mapCol = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);

  const applied = [];
  for (const lineupName of names) {
    const rejected = (REJECTED_DISCOGS_BY_LINEUP[lineupName.trim().toUpperCase()] ?? [])
      .map((row) => row.discogsId)
      .filter(Boolean);

    const outcome = await applyCuratedWebOnlyLineup({
      mapCollection: mapCol,
      Dj,
      lineupName,
      dryRun,
      purgeDiscogsIds: rejected,
    });
    applied.push(outcome);
    console.log(
      `${dryRun ? 'DRY ' : ''}${lineupName} → #${outcome.discogsId} ${outcome.discogsName}` +
        (outcome.purgedDiscogsIds?.length
          ? ` (purged Discogs ${outcome.purgedDiscogsIds.join(', ')})`
          : ''),
    );
  }

  if (!dryRun) {
    await bumpDjCatalogCacheVersion();
  }

  await closeDjDiscogsRedisCache();
  await mongoose.disconnect();

  console.log(`\nDone: ${applied.length} curated web-only lineup(s).`);
}

main().catch(async (error) => {
  console.error('❌ apply-curated-web-only-lineup failed:', error.message ?? error);
  try {
    await closeDjDiscogsRedisCache();
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
