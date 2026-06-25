#!/usr/bin/env node
/**
 * Backfill Discogs artist metadata for lineup artists in the activity catalog.
 * Match flow: Redis (24h) → dj_discogs_map → electronic search + score → djs upsert.
 * Main styles: releases?page=1&per_page=100 → top 5 resource_url → aggregate Top3 styles.
 * Rate limit: DISCOGS_REQUEST_DELAY_MS defaults to 1200ms between Discogs calls.
 * By default only crawls artists missing from MongoDB (incremental).
 * Avatars: `npm run db:sync-lineup-avatars` (TheAudioDB → CloudBase).
 *
 * Usage:
 *   npm run db:crawl-catalog-artists
 *   npm run db:crawl-catalog-artists -- --dry-run
 *   npm run db:crawl-catalog-artists -- --activity-legacy-id 2
 *   npm run db:crawl-catalog-artists -- --names "MEDUZA,KREAM"
 *   npm run db:crawl-catalog-artists -- --names "MEDUZA" --force
 */

import mongoose from 'mongoose';
import { SEED_ONLY_LINEUP_ARTISTS } from './lib/festival-lineup-fallback.mjs';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDiscogsClient,
  createDjDiscogsMapModel,
  createDjModel,
  crawlArtistNames,
  findMissingCatalogArtists,
  getCrawlConfig,
  loadActivityLineupArtistNames,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
  partitionLineupArtistCoverage,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const force = args.includes('--force');
const namesArgIndex = args.indexOf('--names');
const activityLegacyIdArg = args.indexOf('--activity-legacy-id');
const activityLegacyId =
  activityLegacyIdArg >= 0
    ? Number(args[activityLegacyIdArg + 1])
    : Number.NaN;
const explicitNames =
  namesArgIndex >= 0
    ? args[namesArgIndex + 1]
        ?.split(',')
        .map((name) => name.trim())
        .filter(Boolean)
    : null;

function withoutSeedOnly(names) {
  return names.filter(
    (name) => !SEED_ONLY_LINEUP_ARTISTS.has(name.trim().toUpperCase()),
  );
}

async function resolveTargets(db, config, allNames) {
  if (explicitNames?.length) {
    if (force) {
      return {
        targets: withoutSeedOnly(explicitNames),
        covered: [],
        seedOnly: explicitNames.filter((name) =>
          SEED_ONLY_LINEUP_ARTISTS.has(name.trim().toUpperCase()),
        ),
      };
    }
    const partition = await partitionLineupArtistCoverage(db, explicitNames);
    return {
      targets: partition.missing,
      covered: partition.covered,
      seedOnly: partition.seedOnly,
    };
  }

  if (Number.isFinite(activityLegacyId)) {
    if (force) {
      return {
        targets: withoutSeedOnly(allNames),
        covered: [],
        seedOnly: allNames.filter((name) =>
          SEED_ONLY_LINEUP_ARTISTS.has(name.trim().toUpperCase()),
        ),
      };
    }
    const partition = await partitionLineupArtistCoverage(db, allNames);
    return {
      targets: partition.missing,
      covered: partition.covered,
      seedOnly: partition.seedOnly,
    };
  }

  if (force) {
    console.warn(
      '⚠️  全量重抓请指定 --activity-legacy-id 或 --names；全局默认仅补缺',
    );
  }

  const targets = await findMissingCatalogArtists(db, config);
  return { targets, covered: [], seedOnly: [] };
}

async function main() {
  const config = getCrawlConfig();
  if (!config.discogsToken) {
    console.error('❌ 请设置 DISCOGS_TOKEN');
    process.exit(1);
  }

  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const Dj = createDjModel(mongoose);
  const DjDiscogsMap = createDjDiscogsMapModel(mongoose);
  const mapCollection = DjDiscogsMap.collection;
  const discogs = createDiscogsClient(config);

  const scopedToActivity = Number.isFinite(activityLegacyId);
  const allNames = scopedToActivity
    ? await loadActivityLineupArtistNames(db, activityLegacyId, config)
    : explicitNames?.length
      ? explicitNames
      : await loadAllCatalogLineupArtistNames(db, config);

  const { targets, covered, seedOnly } = await resolveTargets(
    db,
    config,
    allNames,
  );

  console.log('✅ MongoDB:', config.mongoUri);
  if (scopedToActivity) {
    console.log(
      `🎤 活动 #${activityLegacyId} 阵容 ${allNames.length} 位（B2B 已拆分）`,
    );
  } else if (explicitNames?.length) {
    console.log(`🎤 指定艺人 ${explicitNames.length} 位`);
  } else {
    console.log(`🎤 活动目录阵容 ${allNames.length} 位（B2B 已拆分）`);
  }
  if (covered.length) {
    console.log(`↷ 已有档案 ${covered.length} 位，跳过`);
  }
  if (seedOnly.length) {
    console.log(`↷ seed-only ${seedOnly.length} 位，跳过 Discogs`);
  }
  console.log(`🔎 待入库 ${targets.length} 位${force ? '（--force）' : ''}`);
  console.log('ℹ️  头像请使用 npm run db:sync-lineup-avatars');

  if (!targets.length) {
    console.log('🎉 阵容艺人档案已全部就绪');
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
    return;
  }

  targets.forEach((name, index) => console.log(`  ${index + 1}. ${name}`));

  if (dryRun) {
    console.log('\n(dry-run，未调用 Discogs)');
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
    return;
  }

  const { upserted, missed, pendingReview } = await crawlArtistNames({
    artistNames: targets,
    discogs,
    Dj,
    mapCollection,
    label: '目录阵容',
  });

  const cacheBumped = await bumpDjCatalogCacheVersion();
  console.log(
    `\n🏁 完成：新增 ${upserted} 条` +
      (missed ? `，未识别/失败 ${missed} 位` : '') +
      (pendingReview ? `，待复核 ${pendingReview} 位` : ''),
  );
  if (cacheBumped) {
    console.log('♻️  已 bump DJ catalog 缓存版本');
  } else {
    console.log('ℹ️  请重启后端以刷新 DJ catalog 内存缓存');
  }

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();
}

main().catch(async (error) => {
  console.error('❌ 抓取失败:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore
  }
  process.exit(1);
});
