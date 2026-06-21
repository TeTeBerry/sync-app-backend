#!/usr/bin/env node
/**
 * Report lineup artist avatar coverage in MongoDB.
 *
 * Usage:
 *   npm run db:report-lineup-avatar-gaps
 */

import mongoose from 'mongoose';
import {
  getCrawlConfig,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { isLineupAvatarAssetKey } from './lib/lineup-avatar-cloud.mjs';

loadDotEnv();

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;

  const lineupNames = await loadAllCatalogLineupArtistNames(db, config);
  const rows = await db
    .collection('lineup_artist_avatars')
    .find({})
    .project({ artistNameKey: 1, artistName: 1, avatarUrl: 1 })
    .toArray();

  const byKey = new Map(rows.map((row) => [row.artistNameKey, row]));

  const covered = [];
  const missing = [];

  for (const name of lineupNames) {
    const key = name.trim().toLowerCase();
    const row = byKey.get(key);
    if (isLineupAvatarAssetKey(row?.avatarUrl)) {
      covered.push(name);
    } else {
      missing.push(name);
    }
  }

  console.log('✅ MongoDB:', config.mongoUri);
  console.log(`🎤 阵容艺人（去重）: ${lineupNames.length}`);
  console.log(`☁️  CloudBase 头像: ${covered.length}`);
  console.log(`❌ 缺失: ${missing.length}`);

  if (missing.length) {
    console.log('\n--- 缺失 ---');
    missing.forEach((name) => console.log(`  ${name}`));
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ 统计失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
