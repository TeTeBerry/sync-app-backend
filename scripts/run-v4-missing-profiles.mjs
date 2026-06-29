#!/usr/bin/env node
/**
 * Run Hermes v4 (web + Discogs research) for artists missing profile bio text.
 *
 * Targets `collectArtistsMissingProfileText` scope: no_map, pending_review,
 * mapped_no_real_profile, manual_stub, and empty_profile (mapped + genres but
 * no djs.profile / Hermes integrated report).
 *
 * Re-fetches the missing list after each batch (so fixed artists drop out).
 * Invokes v4 via tsx directly (avoids nested `npm run` exiting before the loop continues).
 *
 * Usage:
 *   npm run db:run-v4-missing-profiles:dry-run
 *   npm run db:run-v4-missing-profiles
 *   npm run db:run-v4-missing-profiles -- --limit 12 --batch-size 6
 *   npm run db:run-v4-missing-profiles -- --all-at-once
 *   npm run db:run-v4-missing-profiles -- --issue empty_profile
 *   npm run db:run-v4-missing-profiles -- --scope missing-real
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  closeDjDiscogsRedisCache,
  createDjModel,
  getCrawlConfig,
  loadAllCatalogLineupDisplayNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { collectArtistsMissingProfileText } from './lib/lineup-real-artist-catalog.mjs';
import { collectArtistsMissingRealProfile } from './lib/lineup-real-artist-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const hermesRoot = resolve(backendRoot, '../hermes-agent');
const v4Dir = join(hermesRoot, 'v4');
const tsxBin = join(v4Dir, 'node_modules/.bin/tsx');

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const allAtOnce = argv.includes('--all-at-once');

function readArg(flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return argv[index + 1]?.trim() ?? '';
}

function readNumberArg(flag, fallback) {
  const raw = readArg(flag);
  if (!raw) {
    return fallback;
  }
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

async function loadMissingArtists({ issueFilter = '', scope = 'profile-text' } = {}) {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  const mapCol = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);
  const maps = await mapCol.find({}).toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));
  const djs = await Dj.find({}).lean();
  const djById = new Map(djs.map((row) => [row.discogsId, row]));

  const collect =
    scope === 'missing-real'
      ? collectArtistsMissingRealProfile
      : collectArtistsMissingProfileText;

  let missing = collect({
    displayNames,
    mapByKey,
    djById,
  });

  if (issueFilter) {
    missing = missing.filter((row) => row.issue === issueFilter);
  }

  await mongoose.disconnect();
  return { missing, config };
}

function runV4Batch(batch, env) {
  if (!existsSync(tsxBin)) {
    throw new Error(
      `v4 tsx 未安装 — 请先运行: cd ${hermesRoot} && npm install --prefix v4`,
    );
  }

  const args = ['src/index.ts', '--include-mapped', '--no-avatars'];
  for (const name of batch) {
    args.push('--artist', name);
  }

  return new Promise((resolvePromise, reject) => {
    const child = spawn(tsxBin, args, {
      cwd: v4Dir,
      env: {
        ...process.env,
        ...env,
        NODE_OPTIONS: '--disable-warning=MaxListenersExceededWarning',
      },
      stdio: 'inherit',
      detached: false,
    });

    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      const detail = signal ? ` signal ${signal}` : '';
      reject(new Error(`v4 batch exited with code ${code ?? 'null'}${detail}`));
    });
  });
}

function runCommand(command, args, { cwd, env }) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd,
      env: { ...process.env, ...env },
      stdio: 'inherit',
      detached: false,
    });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function rebuildWebOnlyDjs() {
  await runCommand('npm', ['run', 'db:rebuild-web-only-djs'], {
    cwd: backendRoot,
    env: {},
  });
}

async function backfillDjProfilesFromHermes() {
  await runCommand('npm', ['run', 'db:backfill-dj-profiles-from-hermes'], {
    cwd: backendRoot,
    env: {},
  });
}

async function main() {
  const limit = readNumberArg('--limit', 0);
  const batchSize = allAtOnce ? 0 : readNumberArg('--batch-size', 6);
  const issueFilter = readArg('--issue');
  const scope = readArg('--scope') || 'profile-text';

  const { missing: initialMissing } = await loadMissingArtists({
    issueFilter,
    scope,
  });

  if (!initialMissing.length) {
    console.log('🎉 无缺简介艺人，无需 v4 补全');
    return;
  }

  let names = initialMissing.map((row) => row.lineupName);
  if (limit > 0) {
    names = names.slice(0, limit);
  }

  const plannedBatches = allAtOnce
    ? 1
    : Math.ceil(names.length / (batchSize || 1));

  console.log(`\n缺简介: ${names.length} 位（scope=${scope}）`);
  if (allAtOnce) {
    console.log('模式: 一次性（全部艺人单次 v4 子进程）');
  } else {
    console.log(`计划批次数: ${plannedBatches}（每批最多 ${batchSize} 人）`);
  }
  console.log('模式: shadow=off, include-mapped, web-search=on, auto-land=on');
  if (!allAtOnce) {
    console.log('每批 v4 结束后会重新统计缺资料名单并自动继续下一批\n');
  } else {
    console.log('跑完后若仍有缺资料会再开一轮（仍不分批）\n');
  }

  for (const row of initialMissing.slice(0, 20)) {
    console.log(`  · ${row.lineupName} (${row.issue})`);
  }
  if (initialMissing.length > 20) {
    console.log(`  … 另有 ${initialMissing.length - 20} 位`);
  }

  if (dryRun) {
    console.log('\n(dry-run，未调用 Hermes v4)');
    return;
  }

  const config = getCrawlConfig();
  const v4Env = {
    HERMES_V4_SHADOW: '0',
    HERMES_V4_SKIP_MAPPED: '0',
    HERMES_V4_PENDING_ONLY: '0',
    HERMES_V4_SYNC_DJS: '1',
    HERMES_V4_SYNC_AVATARS: '0',
    HERMES_V4_AUTO_LAND_PENDING: '1',
    HERMES_V4_AUTO_LAND_MIN_CONFIDENCE: 'medium',
    SYNC_BACKEND_ROOT: backendRoot,
    MONGODB_URI: config.mongoUri,
    DISCOGS_TOKEN: config.discogsToken ?? '',
  };

  let batchIndex = 0;
  let processed = 0;

  while (true) {
    const { missing: currentMissing } = await loadMissingArtists({
      issueFilter,
      scope,
    });
    if (!currentMissing.length) {
      console.log('\n🎉 缺资料名单已清空');
      break;
    }

    const remainingBudget = limit > 0 ? limit - processed : null;
    if (limit > 0 && remainingBudget <= 0) {
      console.log(`\nℹ️  已达 --limit ${limit}，停止`);
      break;
    }

    const take = allAtOnce
      ? currentMissing.length
      : limit > 0
        ? Math.min(batchSize, remainingBudget)
        : batchSize;
    const batch = currentMissing.slice(0, take).map((row) => row.lineupName);
    batchIndex += 1;
    const estimatedLeft = allAtOnce ? 1 : Math.ceil(currentMissing.length / batchSize);

    console.log(
      `\n${'='.repeat(60)}\n` +
        (allAtOnce
          ? `v4 一次性运行（缺资料 ${currentMissing.length} 人，本轮 ${batch.length}）\n`
          : `v4 批次 ${batchIndex}（缺资料 ${currentMissing.length} 人，本批 ${batch.length}，预计还需约 ${estimatedLeft} 批）\n`) +
        `${'='.repeat(60)}`,
    );
    console.log(`艺人: ${batch.join(', ')}\n`);

    await runV4Batch(batch, v4Env);
    processed += batch.length;

    console.log(
      `\n✅ 批次 ${batchIndex} 完成 — 编排脚本继续，正在准备下一批…`,
    );
  }

  console.log('\n── rebuild-web-only-djs（v4 web-only mapped → djs）──');
  await rebuildWebOnlyDjs();
  console.log('\n── backfill-dj-profiles-from-hermes（Discogs mapped 简介 → djs）──');
  await backfillDjProfilesFromHermes();
  await closeDjDiscogsRedisCache();

  console.log('\n🏁 v4 缺简介补全跑完。建议复查:');
  console.log('npm run db:report-manual-confirmation-artists');
}

main().catch(async (error) => {
  console.error('❌ run-v4-missing-profiles failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore
  }
  process.exit(1);
});
