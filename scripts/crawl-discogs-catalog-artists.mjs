#!/usr/bin/env node
/**
 * Backfill Discogs artist metadata for lineup artists in the activity catalog.
 * Avatars: `npm run db:sync-lineup-avatars` (TheAudioDB → CloudBase).
 *
 * Usage:
 *   npm run db:crawl-catalog-artists
 *   npm run db:crawl-catalog-artists -- --dry-run
 *   npm run db:crawl-catalog-artists -- --names "GREEN VELVET,KANINE"
 */

import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  createDiscogsClient,
  createDjModel,
  crawlArtistNames,
  findMissingCatalogArtists,
  getCrawlConfig,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const namesArgIndex = args.indexOf('--names');
const explicitNames =
  namesArgIndex >= 0
    ? args[namesArgIndex + 1]
        ?.split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    : null;

async function main() {
  const config = getCrawlConfig();
  if (!config.discogsToken) {
    console.error('❌ 请设置 DISCOGS_TOKEN');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const Dj = createDjModel(mongoose);
  const discogs = createDiscogsClient(config);

  const allNames = await loadAllCatalogLineupArtistNames(db, config);
  const targets = explicitNames?.length
    ? explicitNames
    : await findMissingCatalogArtists(db, config);

  console.log('✅ MongoDB:', config.mongoUri);
  console.log(`🎤 活动目录阵容艺人 ${allNames.length} 位（B2B 已拆分）`);
  console.log(`🔎 待入库 ${targets.length} 位`);
  console.log('ℹ️  头像请使用 npm run db:sync-lineup-avatars');

  if (!targets.length) {
    console.log('🎉 阵容艺人档案已全部就绪');
    await mongoose.disconnect();
    return;
  }

  targets.forEach((name, index) => console.log(`  ${index + 1}. ${name}`));

  if (dryRun) {
    console.log('\n(dry-run，未调用 Discogs)');
    await mongoose.disconnect();
    return;
  }

  const { upserted, missed } = await crawlArtistNames({
    artistNames: targets,
    discogs,
    Dj,
    label: '目录阵容',
  });

  const cacheBumped = await bumpDjCatalogCacheVersion();
  console.log(
    `\n🏁 完成：新增 ${upserted} 条` +
      (missed ? `，未识别/失败 ${missed} 位` : ''),
  );
  if (cacheBumped) {
    console.log('♻️  已 bump DJ catalog 缓存版本');
  } else {
    console.log('ℹ️  请重启后端以刷新 DJ catalog 内存缓存');
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ 抓取失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
