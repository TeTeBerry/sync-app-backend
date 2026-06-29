#!/usr/bin/env node
/**
 * Repair dj_discogs_map entries before v3 rematch:
 * - Name mismatch vs lineup display name
 * - Stale pre-v3 search rows (no genre=Electronic) → pending + cache clear on rematch
 *
 * Usage:
 *   npm run db:repair-discogs-maps -- --dry-run
 *   npm run db:repair-discogs-maps -- --apply
 *   npm run db:repair-discogs-maps -- --apply --rematch
 *   npm run db:repair-discogs-maps -- --apply --stale-only
 */

import mongoose from 'mongoose';
import { getDiscogsTrustedNameVariants } from './lib/festival-lineup-fallback.mjs';
import {
  createDjDiscogsMapModel,
  upsertDjDiscogsMapPendingReview,
} from './lib/dj-discogs-map.mjs';
import { clearLineupArtistRematchState, loadDotEnv } from './lib/discogs-crawl.mjs';
import { isProtectedLineupMapSource } from './lib/lineup-map-source.mjs';
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
const staleOnly = args.includes('--stale-only') || args.includes('--legacy-only');
const emitJson = args.includes('--json');

function printRepairJson(payload) {
  if (!emitJson) {
    return;
  }
  console.log('HERMES_REPAIR_JSON:' + JSON.stringify(payload));
}

function inspectMapRow(row) {
  const lineupName = row.lineupName?.trim() ?? '';
  const discogsName = row.discogsName?.trim() ?? '';
  const discogsId = row.discogsId;
  if (!lineupName || !discogsId) {
    return null;
  }

  const { isLineupDiscogsNamePlausible, isStaleDiscogsMapEntry } =
    loadMatchUtil();
  const nameMatchVariants = getDiscogsTrustedNameVariants(lineupName);
  const stale = isStaleDiscogsMapEntry({
    searchQuery: row.searchQuery,
    discoveryStrategyId: row.discoveryStrategyId,
  });

  if (staleOnly && !stale) {
    return null;
  }

  if (
    !isLineupDiscogsNamePlausible(lineupName, discogsName, nameMatchVariants)
  ) {
    return {
      kind: 'name_mismatch',
      reason: `名称不一致（${discogsName || 'unknown'}）`,
      stale,
      searchQuery: row.searchQuery ?? '',
      discoveryStrategyId: row.discoveryStrategyId ?? '',
    };
  }

  if (stale) {
    return {
      kind: 'stale_v3_search',
      reason: '非 v3 搜索参数（无 genre=Electronic），需 rematch',
      stale: true,
      searchQuery: row.searchQuery ?? '',
      discoveryStrategyId: row.discoveryStrategyId ?? '',
    };
  }

  return null;
}

async function main() {
  const mongoUri = process.env.MONGODB_URI ?? 'mongodb://localhost:27017/sync-ai';
  await mongoose.connect(mongoUri);
  const mapModel = createDjDiscogsMapModel(mongoose);
  const mapCollection = mapModel.collection;

  const mapped = await mapCollection.find({ status: 'mapped' }).toArray();
  const suspicious = [];

  for (const row of mapped) {
    if (row.source === 'combo-billing' || isProtectedLineupMapSource(row.source)) {
      continue;
    }
    const verdict = inspectMapRow(row);
    if (verdict) {
      suspicious.push({
        lineupName: row.lineupName,
        discogsId: row.discogsId,
        discogsName: row.discogsName,
        ...verdict,
      });
    }
  }

  suspicious.sort((left, right) => {
    if (left.stale !== right.stale) {
      return left.stale ? -1 : 1;
    }
    if (left.kind !== right.kind) {
      return left.kind === 'stale_v3_search' ? -1 : 1;
    }
    return left.lineupName.localeCompare(right.lineupName);
  });

  const staleCount = suspicious.filter((item) => item.stale).length;
  const nameMismatchCount = suspicious.filter(
    (item) => item.kind === 'name_mismatch',
  ).length;

  console.log(`\n检查 mapped: ${mapped.length} 条`);
  console.log(`需处理: ${suspicious.length} 条`);
  console.log(`  stale 非 v3 search: ${staleCount}`);
  console.log(`  名称不一致: ${nameMismatchCount}\n`);

  if (!suspicious.length) {
    console.log('无需修复。');
    printRepairJson({
      mappedChecked: mapped.length,
      suspiciousCount: 0,
      staleCount: 0,
      nameMismatchCount: 0,
      downgraded: 0,
      clearedMaps: 0,
      names: [],
    });
    await mongoose.disconnect();
    return;
  }

  for (const item of suspicious.slice(0, 30)) {
    console.log(
      `  [${item.kind}] ${item.lineupName} → #${item.discogsId} (${item.discogsName})`,
    );
    console.log(
      `      ${item.reason} | search=${item.searchQuery || '-'} | strategy=${item.discoveryStrategyId || '-'}`,
    );
  }
  if (suspicious.length > 30) {
    console.log(`  … 另有 ${suspicious.length - 30} 条`);
  }

  if (!apply) {
    console.log('\n(dry-run) 加 --apply 执行降级');
    if (staleCount) {
      console.log('  stale 行加 --apply --rematch 清除映射后 v3 重跑');
    }
    printRepairJson({
      mappedChecked: mapped.length,
      suspiciousCount: suspicious.length,
      staleCount,
      nameMismatchCount,
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
      searchQuery: item.stale
        ? 'repair:stale-v3-search'
        : 'repair:name-mismatch',
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
    console.log('  npm run db:crawl-catalog-artists:rematch-mapped');
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
    staleCount,
    nameMismatchCount,
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
