#!/usr/bin/env node
/**
 * Delete stale `djs` rows that are not backed by a mapped `dj_discogs_map` entry.
 *
 * Source of truth:
 *   dj_discogs_map where status=mapped and discogsId is set
 *   (电音节爬虫 · hermes-v4 · hermes-v4-web, etc.)
 *
 * Does NOT delete dj_discogs_map rows — only orphan / wrong-discogsId djs catalog rows.
 *
 * Usage:
 *   npm run db:prune-stale-dj-catalog:dry-run
 *   CONFIRM=1 npm run db:prune-stale-dj-catalog
 *   CONFIRM=1 npm run db:prune-stale-dj-catalog:all
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  deleteDjStylesRedisCache,
  getCrawlConfig,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { readEnvValue } from './lib/parse-env-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

loadDotEnv();

const useAll = process.argv.includes('--all');
const useCloud = process.argv.includes('--cloud') || useAll;

function resolveCloudUri() {
  return (
    process.env.CLOUD_MONGODB_URI ??
    readEnvValue(path.join(ROOT, '.env.production'), 'MONGODB_URI')
  );
}

function resolveLocalUri() {
  return (
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai'
  );
}

function resolveTargetUris() {
  if (useAll) {
    const cloudUri = resolveCloudUri();
    const cloudRedis = resolveCloudRedisUrl();
    if (!cloudUri) {
      throw new Error('--all requires CLOUD_MONGODB_URI or .env.production MONGODB_URI');
    }
    return [
      { label: 'local', uri: resolveLocalUri() },
      { label: 'cloud', uri: cloudUri, redisUrl: cloudRedis },
    ];
  }

  if (useCloud) {
    const cloudUri = resolveCloudUri();
    if (!cloudUri) {
      throw new Error('--cloud requires CLOUD_MONGODB_URI or .env.production MONGODB_URI');
    }
    return [{ label: 'cloud', uri: cloudUri, redisUrl: resolveCloudRedisUrl() }];
  }

  return [{ label: 'local', uri: resolveLocalUri() }];
}

function resolveCloudRedisUrl() {
  return (
    process.env.CLOUD_REDIS_URL ??
    readEnvValue(path.join(ROOT, '.env.production'), 'REDIS_URL')
  );
}

function maskUri(uri) {
  return uri.replace(/:[^:@/]+@/, ':***@');
}

async function collectMappedDiscogsIds(db) {
  const rows = await db
    .collection('dj_discogs_map')
    .find({
      status: 'mapped',
      discogsId: { $exists: true, $ne: null },
    })
    .project({ discogsId: 1, lineupName: 1, source: 1 })
    .toArray();

  const validDiscogsIds = new Set(
    rows
      .map((row) => Number(row.discogsId))
      .filter((id) => Number.isFinite(id) && id > 0),
  );

  return { rows, validDiscogsIds };
}

async function findStaleDjs(db, validDiscogsIds) {
  const allDjs = await db.collection('djs').find({}).toArray();
  const stale = allDjs.filter((dj) => !validDiscogsIds.has(Number(dj.discogsId)));
  return { allDjs, stale };
}

async function pruneTarget(target, { dryRun, confirmed }) {
  process.env.MONGODB_URI = target.uri;
  if (target.redisUrl) {
    process.env.REDIS_URL = target.redisUrl;
  }
  const config = getCrawlConfig();

  console.log(`\n=== ${target.label} (${maskUri(config.mongoUri)}) ===`);
  console.log(
    dryRun
      ? 'Mode: dry-run'
      : confirmed
        ? 'Mode: DELETE'
        : 'Mode: preview (set CONFIRM=1 to delete)',
  );

  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;

  const mapStats = await db
    .collection('dj_discogs_map')
    .aggregate([
      {
        $group: {
          _id: { status: '$status', source: { $ifNull: ['$source', null] } },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ])
    .toArray();

  console.log('\ndj_discogs_map by status+source:');
  for (const row of mapStats) {
    const source = row._id.source ?? '(null)';
    console.log(`  ${row._id.status} · ${source}: ${row.count}`);
  }

  const { rows: mappedRows, validDiscogsIds } = await collectMappedDiscogsIds(db);
  const { allDjs, stale } = await findStaleDjs(db, validDiscogsIds);
  const mappedWithoutDj = mappedRows.filter(
    (row) => !allDjs.some((dj) => Number(dj.discogsId) === Number(row.discogsId)),
  );

  if (validDiscogsIds.size === 0) {
    console.error('');
    console.error(
      '❌ Abort: dj_discogs_map has no mapped discogsId rows — refusing to delete djs.',
    );
    console.error(
      '   Sync dj_discogs_map to this database first, then re-run prune.',
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('');
  console.log(`Mapped discogsIds (truth set): ${validDiscogsIds.size}`);
  console.log(`djs total: ${allDjs.length}`);
  console.log(`Stale djs to delete: ${stale.length}`);
  console.log(`Mapped without djs row: ${mappedWithoutDj.length}`);

  if (stale.length) {
    console.log('');
    console.log('Stale djs (sample):');
    for (const dj of stale.slice(0, 20)) {
      console.log(`  - ${dj.name} (#${dj.discogsId})`);
    }
    if (stale.length > 20) {
      console.log(`  ... and ${stale.length - 20} more`);
    }
  }

  if (mappedWithoutDj.length) {
    console.log('');
    console.log('Mapped but missing djs row (sample — re-crawl if needed):');
    for (const row of mappedWithoutDj.slice(0, 10)) {
      console.log(`  - ${row.lineupName} (#${row.discogsId}) [${row.source ?? ''}]`);
    }
    if (mappedWithoutDj.length > 10) {
      console.log(`  ... and ${mappedWithoutDj.length - 10} more`);
    }
  }

  if (dryRun) {
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    await mongoose.disconnect();
    return;
  }

  let clearedRedis = 0;
  for (const dj of stale) {
    if (await deleteDjStylesRedisCache(dj.discogsId)) {
      clearedRedis += 1;
    }
  }

  const djResult = stale.length
    ? await db.collection('djs').deleteMany({
        _id: { $in: stale.map((row) => row._id) },
      })
    : { deletedCount: 0 };

  await bumpDjCatalogCacheVersion();

  console.log('');
  console.log(`✅ ${target.label}: stale djs removed`);
  console.log(`   djs deleted: ${djResult.deletedCount ?? 0}`);
  console.log(`   Redis style keys cleared: ${clearedRedis}`);
  console.log(`   djs remaining: ${allDjs.length - (djResult.deletedCount ?? 0)}`);

  await mongoose.disconnect();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const confirmed = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';
  const targets = resolveTargetUris();

  for (const target of targets) {
    await pruneTarget(target, { dryRun, confirmed });
  }

  if (dryRun) {
    console.log('\nDry-run only — no data changed.');
  } else if (!confirmed) {
    console.log('\nAborted. Re-run with CONFIRM=1 to delete.');
    process.exit(1);
  }

  await closeDjDiscogsRedisCache();
}

main().catch(async (error) => {
  console.error('❌ prune-stale-dj-catalog failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore
  }
  process.exit(1);
});
