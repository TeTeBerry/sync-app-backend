#!/usr/bin/env node
/**
 * Backfill missing Storm + EDC Thailand lineup DJs only.
 *
 * Compares expanded festival roster (B2B split) against `djs`, then crawls gaps.
 *
 * Usage:
 *   npm run db:crawl-discogs-djs-gap
 *   npm run db:crawl-discogs-djs-gap -- --dry-run
 *   npm run db:crawl-discogs-djs-gap -- --names "GREEN VELVET,KANINE"
 */

import mongoose from 'mongoose';
import {
  crawlArtistNames,
  createDiscogsClient,
  createDjModel,
  findMissingFestivalArtists,
  getCrawlConfig,
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

  const missing = explicitNames?.length
    ? explicitNames
    : await findMissingFestivalArtists(db, config);

  console.log('✅ MongoDB:', config.mongoUri);
  console.log(`🔎 待补爬 ${missing.length} 位艺人`);
  if (!missing.length) {
    console.log('🎉 阵容艺人已全部入库，无需补爬');
    await mongoose.disconnect();
    return;
  }

  missing.forEach((name, index) => console.log(`  ${index + 1}. ${name}`));

  if (dryRun) {
    console.log('\n(dry-run，未调用 Discogs)');
    await mongoose.disconnect();
    return;
  }

  console.log(
    `\nℹ️  每位艺人抓取 ${config.representativeWorksLimit} 张近期发行（含曲目）`,
  );

  const { upserted, missed } = await crawlArtistNames({
    artistNames: missing,
    discogs,
    Dj,
    label: '缺口',
  });

  const stillMissing = await findMissingFestivalArtists(db, config);
  console.log(
    `\n🏁 补爬完成：upsert ${upserted} 条` +
      (missed ? `，未识别/失败 ${missed} 位` : ''),
  );
  if (stillMissing.length) {
    console.log(`⚠️  仍缺 ${stillMissing.length} 位:`, stillMissing.join(', '));
  } else {
    console.log('🎉 阵容艺人现已全部入库');
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ 补爬失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
