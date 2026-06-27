#!/usr/bin/env node
/**
 * One-shot repair after a bad v4 apply + avatar sync run.
 *
 * 1. Purge misapplied hermes-v4-apply maps (solo→duo, combo bundle spread)
 * 2. Delete avatars with reviewFlag (genre_mismatch / low_score)
 * 3. Print re-run commands
 *
 * Usage:
 *   npm run db:repair-v4-misapplied-catalog:dry-run
 *   npm run db:repair-v4-misapplied-catalog
 */

import mongoose from 'mongoose';
import {
  createDjDiscogsMapModel,
  getCrawlConfig,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { deleteDjDiscogsMapEntry } from './lib/dj-discogs-map.mjs';
import { findMisappliedHermesV4Maps } from './lib/lineup-billing-guards.mjs';
import {
  deleteLineupArtistAvatar,
  purgeReviewFlaggedLineupAvatars,
} from './lib/lineup-avatar-cloud.mjs';

loadDotEnv();

const dryRun = process.argv.includes('--dry-run');

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
    })
    .toArray();

  const toPurge = findMisappliedHermesV4Maps(rows);
  const flaggedCount = await db
    .collection('lineup_artist_avatars')
    .countDocuments({
      reviewFlag: { $in: ['genre_mismatch', 'low_score'] },
    });

  console.log(`\n📋 待修复 map: ${toPurge.length} 条`);
  const byReason = new Map();
  for (const row of toPurge) {
    const list = byReason.get(row.reason) ?? [];
    list.push(row);
    byReason.set(row.reason, list);
  }
  for (const [reason, list] of byReason) {
    console.log(`\n  [${reason}] ${list.length} 条`);
    for (const row of list) {
      console.log(
        `    - ${row.lineupName} → #${row.discogsId} ${row.discogsName}`,
      );
    }
  }

  console.log(`\n📋 待删除 reviewFlag 头像: ${flaggedCount} 条`);

  if (dryRun) {
    console.log('\n(dry-run，未写入)');
    await mongoose.disconnect();
    return;
  }

  const purgedNames = [];
  const touchedDiscogsIds = new Set();
  let purgedAvatars = 0;

  for (const row of toPurge) {
    await deleteDjDiscogsMapEntry(mapCollection, row.lineupName);
    purgedNames.push(row.lineupName);
    touchedDiscogsIds.add(row.discogsId);
    if (await deleteLineupArtistAvatar(db, row.lineupName)) {
      purgedAvatars += 1;
    }
  }

  for (const discogsId of touchedDiscogsIds) {
    const stillUsed = await mapCollection.countDocuments({ discogsId });
    if (!stillUsed) {
      await Dj.deleteOne({ discogsId });
    }
  }

  const flaggedPurged = await purgeReviewFlaggedLineupAvatars(db);

  console.log(
    `\n🏁 已清除 ${toPurge.length} 条 map、${purgedAvatars} 条关联头像、` +
      `${flaggedPurged} 条 reviewFlag 头像`,
  );

  const uniqueNames = [...new Set(purgedNames)];
  if (uniqueNames.length) {
    console.log('\n下一步（按顺序）：');
    console.log('  1. npm run db:report-manual-confirmation-artists');
    console.log(
      '  2. hermes-agent 对缺失艺人重跑 v4（或 npm run full-catalog 仅缺失部分）',
    );
    console.log(
      '  3. npm run db:apply-v4-pending-landings -- --min-confidence high',
    );
    if (uniqueNames.length <= 40) {
      console.log(
        `  4. npm run db:sync-lineup-avatars:force -- --names "${uniqueNames.join(',')}"`,
      );
    } else {
      console.log('  4. npm run db:sync-lineup-avatars');
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ 修复失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
