#!/usr/bin/env node
/**
 * Crawl Storm + EDC Thailand lineup DJs from Discogs into MongoDB (`djs`).
 *
 * Usage: npm run db:crawl-discogs-djs
 * Gap only: npm run db:crawl-discogs-djs-gap
 */

import mongoose from 'mongoose';
import {
  crawlArtistNames,
  createDiscogsClient,
  createDjModel,
  getCrawlConfig,
  loadDotEnv,
  loadFestivalLineupArtistNames,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

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

  const artistNames = await loadFestivalLineupArtistNames(db, config);
  console.log('✅ MongoDB:', config.mongoUri);
  console.log(
    `\n🎤 风暴 + EDC Thailand 共 ${artistNames.length} 位艺人（B2B 已拆分）`,
  );
  console.log(`ℹ️  每位艺人抓取 ${config.representativeWorksLimit} 张近期发行（含曲目）`);

  const { upserted, missed } = await crawlArtistNames({
    artistNames,
    discogs,
    Dj,
  });

  console.log(
    `\n🏁 完成：upsert ${upserted} 条` +
      (missed ? `，未匹配/失败 ${missed} 位` : ''),
  );
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
