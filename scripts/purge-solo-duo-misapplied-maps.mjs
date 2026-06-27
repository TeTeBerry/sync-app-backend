#!/usr/bin/env node
/**
 * Find and optionally purge dj_discogs_map rows where a solo lineup key
 * was mapped to a duo/group Discogs page (common hermes-v4-apply mistake).
 *
 * Usage:
 *   npm run db:purge-solo-duo-misapplied-maps
 *   npm run db:purge-solo-duo-misapplied-maps -- --dry-run
 *   npm run db:purge-solo-duo-misapplied-maps -- --names "LARSTIG,SCOT PROJECT"
 */

import mongoose from 'mongoose';
import {
  createDjDiscogsMapModel,
  getCrawlConfig,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import {
  deleteDjDiscogsMapEntry,
  lineupNameKeyFor,
} from './lib/dj-discogs-map.mjs';
import { isSoloLineupMappedToDuoDiscogs } from './lib/lineup-billing-guards.mjs';
import { deleteLineupArtistAvatar } from './lib/lineup-avatar-cloud.mjs';

loadDotEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const namesArgIndex = args.indexOf('--names');
const nameFilter =
  namesArgIndex >= 0
    ? args[namesArgIndex + 1]
        ?.split(',')
        .map((name) => name.trim().toUpperCase())
        .filter(Boolean)
    : null;

async function main() {
  const { mongoUri } = getCrawlConfig();
  await mongoose.connect(mongoUri);
  const db = mongoose.connection.db;
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;
  const Dj = db.collection('djs');

  const rows = await mapCollection
    .find({
      status: 'mapped',
      discogsId: { $exists: true, $ne: null },
      discogsName: { $exists: true, $ne: '' },
    })
    .toArray();

  const mistakes = rows.filter((row) => {
    const lineupName = row.lineupName?.trim() ?? '';
    if (!lineupName) {
      return false;
    }
    if (nameFilter?.length && !nameFilter.includes(lineupName.toUpperCase())) {
      return false;
    }
    return isSoloLineupMappedToDuoDiscogs(lineupName, row.discogsName);
  });

  if (!mistakes.length) {
    console.log('✅ 未发现 solo→duo 错误映射');
    await mongoose.disconnect();
    return;
  }

  console.log(`⚠️  发现 ${mistakes.length} 条 solo→duo 错误映射：`);
  for (const row of mistakes) {
    console.log(
      `  - ${row.lineupName} → #${row.discogsId} ${row.discogsName} (source=${row.source ?? '?'})`,
    );
  }

  if (dryRun) {
    console.log('\n(dry-run，未删除)');
    await mongoose.disconnect();
    return;
  }

  let purgedMaps = 0;
  let purgedAvatars = 0;
  const touchedDiscogsIds = new Set();

  for (const row of mistakes) {
    const lineupName = row.lineupName.trim();
    await deleteDjDiscogsMapEntry(mapCollection, lineupName);
    purgedMaps += 1;
    touchedDiscogsIds.add(row.discogsId);

    if (await deleteLineupArtistAvatar(db, lineupName)) {
      purgedAvatars += 1;
    }
  }

  for (const discogsId of touchedDiscogsIds) {
    const stillUsed = await mapCollection.countDocuments({ discogsId });
    if (!stillUsed) {
      await Dj.deleteOne({ discogsId });
    }
  }

  console.log(
    `\n🏁 已清除 ${purgedMaps} 条 map，${purgedAvatars} 条头像；请重新 split/v4 或手动确认 solo 映射`,
  );
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ 清理失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
