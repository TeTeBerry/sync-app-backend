#!/usr/bin/env node
/**
 * Backfill Discogs artist metadata for lineup artists in the activity catalog.
 *
 * Name → artist_id flow:
 * 1. Lineup English name from festival
 * 2. dj_discogs_map — mapped hit → artist_id → GET /artists/{id} → profile（简介）
 * 3. Miss → v3 tiered search (genre=Electronic) → score → write map
 * 4. pending_review → map only, skip djs (no fabricated profiles)
 * 5. mapped but Discogs 无可用资料 → downgrade to pending_review, skip djs
 * 5. Main styles: top 5 releases aggregated after artist_id is known
 * 6. Avatars: run db:sync-lineup-avatars after crawl (mapped names only)
 *
 * Usage:
 *   npm run db:crawl-catalog-artists
 *   npm run db:crawl-catalog-artists -- --dry-run
 *   npm run db:crawl-catalog-artists -- --activity-legacy-id 2
 *   npm run db:crawl-catalog-artists -- --names "MEDUZA,KREAM"
 *   npm run db:crawl-catalog-artists -- --activity-legacy-id 6 --rematch
 *   npm run db:crawl-catalog-artists -- --pending-review-only --rematch
 *   npm run db:crawl-catalog-artists -- --rematch-mapped
 */

import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  clearLineupArtistRematchState,
  closeDjDiscogsRedisCache,
  createDiscogsClient,
  createDjDiscogsMapModel,
  createDjModel,
  crawlArtistNames,
  expandFestivalArtistNames,
  findMissingCatalogArtists,
  listPendingReviewCatalogArtists,
  listPendingReviewLineupArtists,
  getCrawlConfig,
  loadActivityLineupArtistNames,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
  partitionLineupArtistCoverage,
  listAllMappedLineupNames,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const pendingReviewOnly = args.includes('--pending-review-only');
const rematchMapped = args.includes('--rematch-mapped');
let rematch = args.includes('--rematch') || pendingReviewOnly || rematchMapped;
const force = args.includes('--force') || rematch;
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

async function resolveTargets(db, config, allNames, { pendingReviewOnly: pendingOnly }) {
  if (pendingOnly) {
    const pending = await listPendingReviewLineupArtists(db, allNames);
    return { targets: pending, covered: [] };
  }

  if (explicitNames?.length) {
    if (force) {
      return { targets: explicitNames, covered: [] };
    }
    const partition = await partitionLineupArtistCoverage(db, explicitNames);
    return {
      targets: partition.missing,
      covered: partition.covered,
    };
  }

  if (Number.isFinite(activityLegacyId)) {
    if (force) {
      return { targets: allNames, covered: [] };
    }
    const partition = await partitionLineupArtistCoverage(db, allNames);
    return {
      targets: partition.missing,
      covered: partition.covered,
    };
  }

  if (force) {
    console.warn(
      '⚠️  全量重抓请指定 --activity-legacy-id 或 --names；全局默认仅补缺',
    );
  }

  const targets = await findMissingCatalogArtists(db, config);
  return { targets, covered: [] };
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
  let allNames;
  let targets;
  let covered = [];

  if (rematchMapped) {
    const mappedNames = await listAllMappedLineupNames(mapCollection);
    allNames = expandFestivalArtistNames(mappedNames);
    targets = allNames;
    console.log(
      `♻️  rematch-mapped：当前 mapped ${mappedNames.length} 条 → 拆分后 ${targets.length} 位 solo 艺人`,
    );
  } else {
    allNames = scopedToActivity
      ? await loadActivityLineupArtistNames(db, activityLegacyId)
      : explicitNames?.length
        ? explicitNames
        : await loadAllCatalogLineupArtistNames(db, config);

    const resolved = await resolveTargets(db, config, allNames, {
      pendingReviewOnly,
    });
    targets = resolved.targets;
    covered = resolved.covered;
  }

  console.log('✅ MongoDB:', config.mongoUri);
  if (pendingReviewOnly) {
    console.log(`⏸  仅待复核艺人 ${targets.length} 位（自动 rematch）`);
  } else if (rematchMapped) {
    console.log(`🔎 严格搜索重匹配 ${targets.length} 位（原 mapped，B2B/& 已拆分）`);
  } else if (scopedToActivity) {
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
  const modeLabel = [
    force ? 'force' : null,
    rematch ? 'rematch' : null,
  ]
    .filter(Boolean)
    .join('+');
  console.log(
    `🔎 待入库 ${targets.length} 位${modeLabel ? `（${modeLabel}）` : ''}`,
  );
  console.log(
    'ℹ️  头像请在 crawl 完成后执行: npm run db:sync-lineup-avatars -- --activity-legacy-id <id>',
  );

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

  if (rematch) {
    const mappedNames = rematchMapped
      ? await listAllMappedLineupNames(mapCollection)
      : [];
    const toClear = rematchMapped
      ? [...new Set([...mappedNames, ...targets])]
      : targets;
    const cleared = await clearLineupArtistRematchState(mapCollection, toClear);
    console.log(
      `\n♻️  rematch：清除映射 ${cleared.clearedMaps} 条` +
        `，Redis 主风格 ${cleared.clearedStyleRedis} 条`,
    );
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
