#!/usr/bin/env node
/**
 * Run Hermes v4 (web + Discogs research) for artists missing profile bio text.
 *
 * Default: one v4 subprocess for every artist missing `djs.profile`, then backfill.
 * Use `--batch-size N` only when you need smaller v4 invocations (e.g. debugging).
 *
 * Usage:
 *   npm run db:run-v4-missing-profiles:dry-run
 *   npm run db:run-v4-missing-profiles
 *   npm run db:run-v4-missing-profiles -- --limit 12
 *   npm run db:run-v4-missing-profiles -- --batch-size 6
 *   npm run db:run-v4-missing-profiles -- --issue empty_profile
 *   npm run db:run-v4-missing-profiles -- --scope missing-real
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { backfillDjProfilesFromHermes } from './lib/backfill-dj-profiles-from-hermes.mjs';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  closeDjDiscogsRedisCache,
  createDjModel,
  getCrawlConfig,
  loadAllCatalogLineupDisplayNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import {
  collectArtistsMissingProfileText,
  collectArtistsMissingRealProfile,
} from './lib/lineup-real-artist-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backendRoot = resolve(__dirname, '..');
const hermesRoot = resolve(backendRoot, '../hermes-agent');
const v4Dir = join(hermesRoot, 'v4');
const tsxBin = join(v4Dir, 'node_modules/.bin/tsx');

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

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

function runV4Artists(artists, env) {
  if (!artists.length) {
    return Promise.resolve();
  }
  if (!existsSync(tsxBin)) {
    throw new Error(
      `v4 tsx 未安装 — 请先运行: cd ${hermesRoot} && npm install --prefix v4`,
    );
  }

  const args = ['src/index.ts', '--include-mapped', '--no-avatars'];
  for (const name of artists) {
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
      reject(new Error(`v4 exited with code ${code ?? 'null'}${detail}`));
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

function chunkNames(names, size) {
  const chunks = [];
  for (let i = 0; i < names.length; i += size) {
    chunks.push(names.slice(i, i + size));
  }
  return chunks;
}

async function main() {
  const limit = readNumberArg('--limit', 0);
  const batchSize = readNumberArg('--batch-size', 0);
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

  console.log(`\n缺简介: ${names.length} 位（scope=${scope}）`);
  if (batchSize > 0) {
    console.log(
      `模式: 分 ${Math.ceil(names.length / batchSize)} 次 v4 子进程（每批 ${batchSize} 人）`,
    );
  } else {
    console.log('模式: 一次性（全部缺简介艺人单次 v4 子进程）');
  }
  console.log('模式: shadow=off, include-mapped, web-search=on, auto-land=on\n');

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
    HERMES_REBUILD_WEB_ONLY_DJS: '0',
    SYNC_BACKEND_ROOT: backendRoot,
    MONGODB_URI: config.mongoUri,
    DISCOGS_TOKEN: config.discogsToken ?? '',
  };

  const v4Runs = batchSize > 0 ? chunkNames(names, batchSize) : [names];

  for (let i = 0; i < v4Runs.length; i += 1) {
    const artists = v4Runs[i];
    console.log(
      `\n${'='.repeat(60)}\n` +
        `v4 运行 ${i + 1}/${v4Runs.length}（${artists.length} 人）\n` +
        `${'='.repeat(60)}`,
    );
    console.log(`艺人: ${artists.join(', ')}\n`);
    await runV4Artists(artists, v4Env);
  }

  console.log('\n── Hermes 资料 → djs.profile ──');
  await mongoose.connect(config.mongoUri);
  const backfill = await backfillDjProfilesFromHermes({ mongoose });
  await mongoose.disconnect();
  console.log(
    `  backfill: ${backfill.updated} patched, ${backfill.skipped} skipped (${backfill.scanned} rows scanned)`,
  );

  console.log('\n── rebuild-web-only-djs（web-only mapped → djs）──');
  await rebuildWebOnlyDjs();
  await closeDjDiscogsRedisCache();

  const { missing: remaining } = await loadMissingArtists({
    issueFilter,
    scope,
  });
  if (remaining.length) {
    console.log(`\nℹ️  仍有 ${remaining.length} 位缺简介（v4 未产出可落库资料或需人工处理）`);
  } else {
    console.log('\n🎉 缺简介名单已清空');
  }

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
