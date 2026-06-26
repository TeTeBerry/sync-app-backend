#!/usr/bin/env node
/**
 * Delete DJ catalog rows that are not tied to any current activity lineup.
 *
 * Collections:
 *   - djs
 *   - dj_discogs_map
 *   - lineup_artist_avatars
 *
 * Usage:
 *   npm run db:prune-orphan-lineup-artists:dry-run
 *   CONFIRM=1 npm run db:prune-orphan-lineup-artists
 *   npm run db:prune-orphan-lineup-artists:dry-run -- --cloud
 *   CONFIRM=1 npm run db:prune-orphan-lineup-artists -- --cloud
 *   CONFIRM=1 npm run db:prune-orphan-lineup-artists -- --all
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  deleteDjStylesRedisCache,
  findOrphanLineupArtistRows,
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
    if (!cloudUri) {
      throw new Error('--all requires CLOUD_MONGODB_URI or .env.production MONGODB_URI');
    }
    return [
      { label: 'local', uri: resolveLocalUri() },
      { label: 'cloud', uri: cloudUri },
    ];
  }

  if (useCloud) {
    const cloudUri = resolveCloudUri();
    if (!cloudUri) {
      throw new Error('--cloud requires CLOUD_MONGODB_URI or .env.production MONGODB_URI');
    }
    return [{ label: 'cloud', uri: cloudUri }];
  }

  return [{ label: 'local', uri: resolveLocalUri() }];
}

const dryRun = process.argv.includes('--dry-run');
const confirmed = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';

function maskUri(uri) {
  return uri.replace(/:[^:@/]+@/, ':***@');
}

async function pruneTarget(target, { dryRun, confirmed }) {
  process.env.MONGODB_URI = target.uri;
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

  const { scope, orphanDjs, orphanMaps, orphanAvatars } =
    await findOrphanLineupArtistRows(db, config);

  console.log(`Lineup 录入名: ${scope.displayNames.length} 条（严格匹配）`);
  console.log('');
  console.log('Would delete:');
  console.log(`  djs: ${orphanDjs.length}`);
  console.log(`  dj_discogs_map: ${orphanMaps.length}`);
  console.log(`  lineup_artist_avatars: ${orphanAvatars.length}`);

  if (orphanDjs.length) {
    console.log('');
    console.log('Orphan djs (sample):');
    for (const dj of orphanDjs.slice(0, 15)) {
      console.log(`  - ${dj.name} (#${dj.discogsId})`);
    }
    if (orphanDjs.length > 15) {
      console.log(`  ... and ${orphanDjs.length - 15} more`);
    }
  }

  if (orphanMaps.length) {
    console.log('');
    console.log('Orphan dj_discogs_map (sample):');
    for (const row of orphanMaps.slice(0, 15)) {
      console.log(`  - ${row.lineupName}`);
    }
    if (orphanMaps.length > 15) {
      console.log(`  ... and ${orphanMaps.length - 15} more`);
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
  const discogsIdsToClear = new Set(
    [...orphanDjs, ...orphanMaps]
      .map((row) => row.discogsId)
      .filter((id) => Number.isFinite(id)),
  );

  for (const discogsId of discogsIdsToClear) {
    if (await deleteDjStylesRedisCache(discogsId)) {
      clearedRedis += 1;
    }
  }

  const djResult = orphanDjs.length
    ? await db
        .collection('djs')
        .deleteMany({ _id: { $in: orphanDjs.map((row) => row._id) } })
    : { deletedCount: 0 };
  const mapResult = orphanMaps.length
    ? await db.collection('dj_discogs_map').deleteMany({
        _id: { $in: orphanMaps.map((row) => row._id) },
      })
    : { deletedCount: 0 };
  const avatarResult = orphanAvatars.length
    ? await db.collection('lineup_artist_avatars').deleteMany({
        _id: { $in: orphanAvatars.map((row) => row._id) },
      })
    : { deletedCount: 0 };

  await bumpDjCatalogCacheVersion();

  console.log('');
  console.log(`✅ ${target.label}: orphan lineup artist data removed`);
  console.log(`   djs deleted: ${djResult.deletedCount ?? 0}`);
  console.log(`   dj_discogs_map deleted: ${mapResult.deletedCount ?? 0}`);
  console.log(
    `   lineup_artist_avatars deleted: ${avatarResult.deletedCount ?? 0}`,
  );
  console.log(`   Redis style keys cleared: ${clearedRedis}`);

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
  console.error('❌ prune-orphan-lineup-artists failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore
  }
  process.exit(1);
});
