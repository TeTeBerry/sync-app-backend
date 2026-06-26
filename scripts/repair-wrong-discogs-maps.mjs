#!/usr/bin/env node
/**
 * Downgrade dj_discogs_map entries whose Discogs name does not match the lineup name.
 *
 * Usage:
 *   npm run db:repair-discogs-maps -- --dry-run
 *   npm run db:repair-discogs-maps
 *   npm run db:repair-discogs-maps -- --apply --rematch
 */

import mongoose from 'mongoose';
import { getDiscogsSearchQueries } from './lib/festival-lineup-fallback.mjs';
import {
  createDjDiscogsMapModel,
  upsertDjDiscogsMapPendingReview,
} from './lib/dj-discogs-map.mjs';
import { clearLineupArtistRematchState, loadDotEnv } from './lib/discogs-crawl.mjs';
import { resolveDistRoot, requireFromDist } from './lib/resolve-dist-root.mjs';
import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

loadDotEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..');

function loadMatchUtil() {
  if (!resolveDistRoot()) {
    console.log('dist missing — building for Discogs match util…');
    execSync('npm run build', { cwd: repoRoot, stdio: 'inherit' });
  }
  return requireFromDist('modules/dj/discogs-artist-match.util');
}

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const rematch = args.includes('--rematch');
const emitJson = args.includes('--json');

function printRepairJson(payload) {
  if (!emitJson) {
    return;
  }
  console.log('HERMES_REPAIR_JSON:' + JSON.stringify(payload));
}

function shouldDowngrade(row) {
  const lineupName = row.lineupName?.trim() ?? '';
  const discogsName = row.discogsName?.trim() ?? '';
  const discogsId = row.discogsId;
  if (!lineupName || !discogsId) {
    return null;
  }

  const { isLineupDiscogsNamePlausible } = loadMatchUtil();
  const allowedDiscogsNames = getDiscogsSearchQueries(lineupName);
  if (
    isLineupDiscogsNamePlausible(lineupName, discogsName, allowedDiscogsNames)
  ) {
    return null;
  }

  return {
    reason: `名称不一致（${discogsName || 'unknown'}）`,
  };
}

async function main() {
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/sync-ai';
  await mongoose.connect(mongoUri);
  const mapModel = createDjDiscogsMapModel(mongoose);
  const mapCollection = mapModel.collection;

  const mapped = await mapCollection.find({ status: 'mapped' }).toArray();
  const suspicious = [];

  for (const row of mapped) {
    const verdict = shouldDowngrade(row);
    if (verdict) {
      suspicious.push({
        lineupName: row.lineupName,
        discogsId: row.discogsId,
        discogsName: row.discogsName,
        ...verdict,
      });
    }
  }

  console.log(`\n检查 mapped: ${mapped.length} 条`);
  console.log(`可疑映射: ${suspicious.length} 条\n`);

  if (!suspicious.length) {
    console.log('无需修复。');
    printRepairJson({
      mappedChecked: mapped.length,
      suspiciousCount: 0,
      downgraded: 0,
      clearedMaps: 0,
      names: [],
    });
    await mongoose.disconnect();
    return;
  }

  for (const item of suspicious.slice(0, 30)) {
    console.log(
      `  ${item.lineupName} → #${item.discogsId} (${item.discogsName}) — ${item.reason}`,
    );
  }
  if (suspicious.length > 30) {
    console.log(`  … 另有 ${suspicious.length - 30} 条`);
  }

  if (!apply) {
    console.log('\n(dry-run) 加 --apply 执行降级');
    printRepairJson({
      mappedChecked: mapped.length,
      suspiciousCount: suspicious.length,
      downgraded: 0,
      clearedMaps: 0,
      names: suspicious.map((item) => item.lineupName),
    });
    await mongoose.disconnect();
    return;
  }

  let downgraded = 0;
  for (const item of suspicious) {
    await upsertDjDiscogsMapPendingReview(mapCollection, {
      lineupName: item.lineupName,
      searchQuery: 'repair:name-mismatch',
      reviewReason: item.reason,
    });
    downgraded += 1;
  }

  console.log(`\n已降级 ${downgraded} 条为 pending_review`);

  let clearedMaps = 0;
  if (rematch) {
    const names = suspicious.map((item) => item.lineupName);
    const cleared = await clearLineupArtistRematchState(mapCollection, names);
    clearedMaps = cleared.clearedMaps;
    console.log(`已清除 ${clearedMaps} 条映射缓存，可运行 rematch crawl`);
    console.log(
      `  npm run db:crawl-catalog-artists -- --names "${names.slice(0, 5).join(',')}" --rematch`,
    );
    if (names.length > 5) {
      console.log(`  … 共 ${names.length} 个艺人需分批 rematch`);
    }
  }

  printRepairJson({
    mappedChecked: mapped.length,
    suspiciousCount: suspicious.length,
    downgraded,
    clearedMaps,
    names: suspicious.map((item) => item.lineupName),
  });

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
