#!/usr/bin/env node
/**
 * Resolve pending_review artists:
 *   1. Priority names → Discogs ID fix or curated manual profile
 *   2. All other pending → keep pending_review (no auto stub)
 *
 * Usage:
 *   npm run db:resolve-pending-batch
 *   npm run db:resolve-pending-batch -- --dry-run
 */

import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDiscogsClient,
  createDjDiscogsMapModel,
  createDjModel,
  getCrawlConfig,
  loadDotEnv,
  upsertDjRecord,
} from './lib/discogs-crawl.mjs';
import { upsertDjDiscogsMapMapped } from './lib/dj-discogs-map.mjs';
import { DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL } from './lib/lineup-discogs-search.mjs';
import {
  buildManualStubProfile,
  isPriorityPendingLineupName,
  PRIORITY_PENDING_DISCOGS,
  PRIORITY_PENDING_MANUAL,
} from './lib/lineup-pending-manual-stubs.mjs';

loadDotEnv();

const dryRun = process.argv.includes('--dry-run');

async function writeDiscogsMapped({
  Dj,
  mapCollection,
  lineupName,
  discogsId,
  discogsName,
  searchQuery,
  discogs,
}) {
  const data = await discogs.buildDjRecord(discogsId);
  if (!discogs.isVerifiableDiscogsDjRecord(data)) {
    throw new Error(`Discogs #${discogsId} 资料未通过校验`);
  }
  if (discogsName && discogsName !== data.name) {
    data.name = discogsName;
  }
  await upsertDjRecord(Dj, data);
  await upsertDjDiscogsMapMapped(mapCollection, {
    lineupName,
    discogsId,
    discogsName: discogsName ?? data.name,
    matchScore: 200,
    searchQuery,
    source: DISCOGS_MAP_SOURCE_FESTIVAL_CRAWL,
  });
}

async function writeManualMapped({ Dj, mapCollection, lineupName, profile }) {
  const data = { ...profile, crawledAt: new Date() };
  await upsertDjRecord(Dj, data);
  await upsertDjDiscogsMapMapped(mapCollection, {
    lineupName,
    discogsId: profile.discogsId,
    discogsName: profile.name,
    matchScore: 100,
    searchQuery: '#manual-profile',
    source: 'manual-stub',
  });
}

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const Dj = createDjModel(mongoose);
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;
  const discogs = createDiscogsClient(config);

  const pending = await mapCollection
    .find({ status: 'pending_review' })
    .project({ lineupName: 1 })
    .sort({ lineupName: 1 })
    .toArray();

  console.log(`\n=== resolve pending (${pending.length}) ${dryRun ? 'DRY-RUN' : ''} ===`);

  let priorityDiscogs = 0;
  let priorityManual = 0;
  let bulkManual = 0;
  let failed = 0;

  for (const row of pending) {
    const lineupName = row.lineupName?.trim();
    if (!lineupName) {
      continue;
    }
    const upper = lineupName.toUpperCase();

    try {
      if (PRIORITY_PENDING_DISCOGS[upper]) {
        const fix = PRIORITY_PENDING_DISCOGS[upper];
        console.log(`\n★ Discogs  ${lineupName} → #${fix.discogsId} (${fix.discogsName})`);
        if (!dryRun) {
          await writeDiscogsMapped({
            Dj,
            mapCollection,
            lineupName,
            discogsId: fix.discogsId,
            discogsName: fix.discogsName,
            searchQuery: fix.searchQuery,
            discogs,
          });
        }
        priorityDiscogs += 1;
        continue;
      }

      if (PRIORITY_PENDING_MANUAL[upper]) {
        const curated = PRIORITY_PENDING_MANUAL[upper];
        const profile = buildManualStubProfile(lineupName, curated);
        console.log(`\n★ Manual   ${lineupName} → #${profile.discogsId} (${profile.name})`);
        if (!dryRun) {
          await writeManualMapped({ Dj, mapCollection, lineupName, profile });
        }
        priorityManual += 1;
        continue;
      }

      if (isPriorityPendingLineupName(lineupName)) {
        continue;
      }

      console.log(`\n· pending ${lineupName} — 保留 pending_review（不自动生成 stub）`);
      continue;
    } catch (error) {
      failed += 1;
      console.warn(`⚠️  失败 ${lineupName}:`, error.message ?? error);
    }
  }

  const remaining = dryRun
    ? '—'
    : await mapCollection.countDocuments({ status: 'pending_review' });

  console.log(
    `\n🏁 完成：Discogs ${priorityDiscogs}，优先 manual ${priorityManual}，` +
      `bulk manual ${bulkManual}` +
      (failed ? `，失败 ${failed}` : '') +
      `\n   剩余 pending_review: ${remaining}`,
  );

  if (!dryRun) {
    await bumpDjCatalogCacheVersion();
  }

  await closeDjDiscogsRedisCache();
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ resolve-pending-batch failed:', error.message ?? error);
  try {
    await closeDjDiscogsRedisCache();
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
