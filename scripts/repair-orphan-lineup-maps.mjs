#!/usr/bin/env node
/**
 * Re-link dj_discogs_map rows for solo lineup names whose djs row survived
 * a rematch wipe (orphan DJ: profile exists, map missing).
 *
 * Usage:
 *   npm run db:repair-orphan-lineup-maps -- --dry-run
 *   npm run db:repair-orphan-lineup-maps
 */
import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  collectOrphanLineupMapRepairs,
  createDjModel,
  getCrawlConfig,
  loadAllCatalogLineupDisplayNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import {
  createDjDiscogsMapModel,
  upsertDjDiscogsMapMapped,
} from './lib/dj-discogs-map.mjs';
import { DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL } from './lib/lineup-discogs-search.mjs';
import { collectArtistsMissingRealProfile } from './lib/lineup-real-artist-catalog.mjs';

loadDotEnv();

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const mapCol = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);

  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  const maps = await mapCol.find({}).toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));
  const djs = await Dj.find({}).lean();
  const djById = new Map(djs.map((row) => [row.discogsId, row]));

  const missingArtists = collectArtistsMissingRealProfile({
    displayNames,
    mapByKey,
    djById,
  });
  const { repairs, ambiguous } = collectOrphanLineupMapRepairs({
    missingArtists,
    djs,
  });

  console.log(`\n孤儿 DJ（有 djs、无 map）可修复: ${repairs.length}`);
  if (ambiguous.length) {
    console.log(`歧义（跳过）: ${ambiguous.length}`);
  }

  if (!repairs.length) {
    await mongoose.disconnect();
    return;
  }

  for (const row of repairs.slice(0, 20)) {
    console.log(`- ${row.lineupName} → #${row.discogsId} ${row.discogsName}`);
  }
  if (repairs.length > 20) {
    console.log(`  … 另有 ${repairs.length - 20} 条`);
  }

  if (dryRun) {
    console.log('\n(dry-run，未写入 dj_discogs_map)');
    await mongoose.disconnect();
    return;
  }

  let repaired = 0;
  for (const row of repairs) {
    await upsertDjDiscogsMapMapped(mapCol, {
      lineupName: row.lineupName,
      discogsId: row.discogsId,
      discogsName: row.discogsName,
      matchScore: 100,
      searchQuery: '#orphan-map-repair',
      discoveryStrategyId: 'orphan-map-repair',
      source: DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
    });
    repaired += 1;
  }

  await bumpDjCatalogCacheVersion();
  console.log(`\n🏁 已修复 ${repaired} 条 map`);
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ repair-orphan-lineup-maps failed:', error.message ?? error);
  process.exit(1);
});
