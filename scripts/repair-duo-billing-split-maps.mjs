#!/usr/bin/env node
/**
 * Remove erroneous solo dj_discogs_map rows created by combo-billing splits
 * when the festival billing name is a fixed duo act.
 *
 * Usage:
 *   npm run db:repair-duo-billing-split-maps:dry-run
 *   npm run db:repair-duo-billing-split-maps
 */
import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  getCrawlConfig,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import {
  createDjDiscogsMapModel,
  deleteDjDiscogsMapEntry,
  lineupNameKeyFor,
} from './lib/dj-discogs-map.mjs';

loadDotEnv();

/** Duo billing display name → solo artifact rows to delete when duo map exists. */
const DUO_BILLING_SOLO_ARTIFACTS = {
  'BLOCK & CROWN': ['BLOCK', 'CROWN'],
  'MIKE & ME': ['MIKE', 'ME'],
};

const dryRun = process.argv.includes('--dry-run');

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const mapCol = createDjDiscogsMapModel(mongoose).collection;

  let deleted = 0;

  for (const [duoName, soloNames] of Object.entries(DUO_BILLING_SOLO_ARTIFACTS)) {
    const duoKey = lineupNameKeyFor(duoName);
    const duoRow = await mapCol.findOne({ lineupNameKey: duoKey });
    if (!duoRow || duoRow.status !== 'mapped' || !duoRow.discogsId) {
      console.warn(`⚠️  跳过 ${duoName}：duo map 不存在或未 mapped`);
      continue;
    }

    console.log(`\n${duoName} (#${duoRow.discogsId})`);
    for (const soloName of soloNames) {
      const soloKey = lineupNameKeyFor(soloName);
      const soloRow = await mapCol.findOne({ lineupNameKey: soloKey });
      if (!soloRow) {
        console.log(`   - ${soloName}: 无 map，跳过`);
        continue;
      }

      console.log(
        `   - ${soloName}: delete map #${soloRow.discogsId ?? '—'} (${soloRow.source ?? 'unknown'})`,
      );
      if (!dryRun) {
        await deleteDjDiscogsMapEntry(mapCol, soloName);
        deleted += 1;
      }
    }
  }

  if (dryRun) {
    console.log('\n(dry-run，未删除 dj_discogs_map)');
  } else {
    await bumpDjCatalogCacheVersion();
    console.log(`\n✅ 已删除 ${deleted} 条 billing 拆分误映射`);
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ repair-duo-billing-split-maps failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
