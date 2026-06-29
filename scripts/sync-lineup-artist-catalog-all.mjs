#!/usr/bin/env node
/**
 * Sync DJ catalog (djs + dj_discogs_map + lineup avatars) between local and cloud MongoDB.
 * Avatar URLs are public HTTPS CDN links (Discogs / TheAudioDB); this script copies metadata only.
 *
 * Usage:
 *   npm run db:sync-lineup-artist-catalog:all
 *   SOURCE_MONGODB_URI='mongodb://127.0.0.1:27017/sync-ai' npm run db:sync-lineup-artist-catalog:all
 *   npm run db:sync-lineup-artist-catalog:all -- --cloud-only
 *   npm run db:sync-lineup-artist-catalog:all -- --cloud-only --mirror
 *     # upsert then delete cloud rows not present in source (full-catalog uses this)
 *   npm run db:pull-lineup-artist-catalog-from-cloud
 *     # mirror cloud → local (djs + dj_discogs_map + avatars)
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { loadDotEnv } from './lib/discogs-crawl.mjs';
import { readEnvValue } from './lib/parse-env-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

loadDotEnv();

function maskUri(uri) {
  return uri.replace(/:[^:@/]+@/, ':***@');
}

function resolveLocalUri() {
  return (
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai'
  );
}

function resolveCloudUri() {
  return (
    process.env.CLOUD_MONGODB_URI ??
    readEnvValue(path.join(ROOT, '.env.production'), 'MONGODB_URI')
  );
}

function resolveSourceUri() {
  const fromCloud = process.argv.includes('--from-cloud');
  if (fromCloud) {
    const cloudUri = resolveCloudUri();
    if (!cloudUri) {
      throw new Error(
        'Cloud URI required for --from-cloud. Set CLOUD_MONGODB_URI or MONGODB_URI in .env.production',
      );
    }
    return cloudUri;
  }

  return (
    process.env.SOURCE_MONGODB_URI ??
    process.env.LOCAL_MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai'
  );
}

function resolveTargets() {
  const fromCloud = process.argv.includes('--from-cloud');
  const syncLocal = process.argv.includes('--with-local');
  const cloudOnly = process.argv.includes('--cloud-only');
  const localOnly = process.argv.includes('--local-only');
  const targets = [];

  const localUri = resolveLocalUri();
  const cloudUri = resolveCloudUri();

  if (fromCloud) {
    targets.push({ label: 'local', uri: localUri });
    return targets;
  }

  if (syncLocal && !cloudOnly) {
    targets.push({ label: 'local', uri: localUri });
  }

  if (!localOnly && cloudUri) {
    targets.push({ label: 'cloud', uri: cloudUri });
  }

  if (targets.length === 0) {
    throw new Error(
      'No MongoDB targets. Set CLOUD_MONGODB_URI or add MONGODB_URI to .env.production',
    );
  }

  return targets;
}

async function loadSourceCollections(sourceUri) {
  await mongoose.connect(sourceUri);
  const db = mongoose.connection.db;
  const [djs, avatars, maps] = await Promise.all([
    db.collection('djs').find({}).toArray(),
    db.collection('lineup_artist_avatars').find({}).toArray(),
    db.collection('dj_discogs_map').find({}).toArray(),
  ]);
  await mongoose.disconnect();
  return { djs, avatars, maps };
}

async function upsertDjs(uri, rows) {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('djs');
  let upserted = 0;

  for (const row of rows) {
    const { _id, createdAt, ...payload } = row;
    void _id;
    if (!payload.discogsId) {
      continue;
    }
    await collection.updateOne(
      { discogsId: payload.discogsId },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: createdAt ?? new Date() },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  const count = await collection.countDocuments();
  await mongoose.disconnect();
  return { upserted, total: count };
}

async function mirrorDjs(uri, rows) {
  const sourceIds = [
    ...new Set(
      rows
        .map((row) => row.discogsId)
        .filter((id) => Number.isFinite(id)),
    ),
  ];

  if (!sourceIds.length) {
    console.warn('⚠️  source djs 为空 — 跳过 mirror 删除');
    await mongoose.connect(uri);
    const total = await mongoose.connection.db.collection('djs').countDocuments();
    await mongoose.disconnect();
    return { deleted: 0, total, sourceCount: 0 };
  }

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('djs');

  const deleteFilter =
    sourceIds.length > 0
      ? { discogsId: { $nin: sourceIds } }
      : {};

  const deleteResult = await collection.deleteMany(deleteFilter);
  const total = await collection.countDocuments();
  await mongoose.disconnect();

  return {
    deleted: deleteResult.deletedCount ?? 0,
    total,
    sourceCount: sourceIds.length,
  };
}

async function upsertMaps(uri, rows) {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('dj_discogs_map');
  let upserted = 0;

  for (const row of rows) {
    const { _id, createdAt, updatedAt, ...payload } = row;
    void _id;
    void updatedAt;
    const lineupNameKey = payload.lineupNameKey?.trim();
    if (!lineupNameKey || !payload.lineupName?.trim()) {
      continue;
    }
    await collection.updateOne(
      { lineupNameKey },
      {
        $set: {
          ...payload,
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: createdAt ?? new Date() },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  const count = await collection.countDocuments();
  await mongoose.disconnect();
  return { upserted, total: count };
}

async function mirrorMaps(uri, rows) {
  const validKeys = [
    ...new Set(
      rows
        .map((row) => row.lineupNameKey?.trim())
        .filter(Boolean),
    ),
  ];

  if (!validKeys.length) {
    console.warn('⚠️  source dj_discogs_map 为空 — 跳过 mirror 删除');
    await mongoose.connect(uri);
    const total = await mongoose.connection.db
      .collection('dj_discogs_map')
      .countDocuments();
    await mongoose.disconnect();
    return { deleted: 0, total, sourceCount: 0 };
  }

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('dj_discogs_map');

  const deleteResult = await collection.deleteMany({
    lineupNameKey: { $nin: validKeys },
  });
  const total = await collection.countDocuments();
  await mongoose.disconnect();

  return {
    deleted: deleteResult.deletedCount ?? 0,
    total,
    sourceCount: validKeys.length,
  };
}

async function upsertAvatars(uri, rows) {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('lineup_artist_avatars');
  let upserted = 0;

  for (const row of rows) {
    const { _id, createdAt, ...payload } = row;
    void _id;
    if (!payload.artistNameKey || !payload.avatarUrl) {
      continue;
    }
    await collection.updateOne(
      { artistNameKey: payload.artistNameKey },
      {
        $set: {
          artistName: payload.artistName,
          artistNameKey: payload.artistNameKey,
          avatarUrl: payload.avatarUrl,
          source: payload.source ?? 'cdn',
          updatedAt: new Date(),
        },
        $setOnInsert: { createdAt: createdAt ?? new Date() },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  const count = await collection.countDocuments();
  await mongoose.disconnect();
  return { upserted, total: count };
}

async function mirrorAvatars(uri, rows) {
  const validKeys = [
    ...new Set(
      rows
        .filter((row) => row.artistNameKey?.trim() && row.avatarUrl?.trim())
        .map((row) => row.artistNameKey.trim()),
    ),
  ];

  if (!validKeys.length) {
    console.warn('⚠️  source avatars 为空 — 跳过 mirror 删除');
    await mongoose.connect(uri);
    const total = await mongoose.connection.db
      .collection('lineup_artist_avatars')
      .countDocuments();
    await mongoose.disconnect();
    return { deleted: 0, total, sourceCount: 0 };
  }

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('lineup_artist_avatars');

  const deleteFilter =
    validKeys.length > 0
      ? { artistNameKey: { $nin: validKeys } }
      : {};

  const deleteResult = await collection.deleteMany(deleteFilter);
  const total = await collection.countDocuments();
  await mongoose.disconnect();

  return {
    deleted: deleteResult.deletedCount ?? 0,
    total,
    sourceCount: validKeys.length,
  };
}

async function main() {
  const mirror = process.argv.includes('--mirror') || process.argv.includes('--from-cloud');
  const fromCloud = process.argv.includes('--from-cloud');
  const sourceUri = resolveSourceUri();
  const targets = resolveTargets();

  console.log(
    `\n=== Loading source (${fromCloud ? 'cloud → local' : 'push'}) ${maskUri(sourceUri)} ===`,
  );
  const { djs, avatars, maps } = await loadSourceCollections(sourceUri);
  console.log(`📀 djs: ${djs.length}`);
  console.log(`🗺️  dj_discogs_map: ${maps.length}`);
  console.log(`🖼️  lineup_artist_avatars: ${avatars.length}`);
  if (mirror) {
    console.log('🪞 mirror mode: targets will match source exactly (delete extras)');
  }

  for (const target of targets) {
    console.log(`\n=== Syncing to ${target.label} (${maskUri(target.uri)}) ===`);

    const mapResult = await upsertMaps(target.uri, maps);
    console.log(
      `✅ dj_discogs_map: upserted ${mapResult.upserted}, collection total ${mapResult.total}`,
    );
    if (mirror) {
      const mapMirror = await mirrorMaps(target.uri, maps);
      console.log(
        `🪞 maps mirror: deleted ${mapMirror.deleted} extras, ` +
          `now ${mapMirror.total} (source ${mapMirror.sourceCount})`,
      );
    }

    const djResult = await upsertDjs(target.uri, djs);
    console.log(
      `✅ djs: upserted ${djResult.upserted}, collection total ${djResult.total}`,
    );
    if (mirror) {
      const djMirror = await mirrorDjs(target.uri, djs);
      console.log(
        `🪞 djs mirror: deleted ${djMirror.deleted} extras, ` +
          `now ${djMirror.total} (source ${djMirror.sourceCount})`,
      );
    }

    const avatarResult = await upsertAvatars(target.uri, avatars);
    console.log(
      `✅ lineup_artist_avatars: upserted ${avatarResult.upserted}, collection total ${avatarResult.total}`,
    );
    if (mirror) {
      const avatarMirror = await mirrorAvatars(target.uri, avatars);
      console.log(
        `🪞 avatars mirror: deleted ${avatarMirror.deleted} extras, ` +
          `now ${avatarMirror.total} (source ${avatarMirror.sourceCount})`,
      );
    }
  }

  console.log(
    mirror
      ? '\n✅ DJ catalog + maps + avatars mirrored to target(s) from source.'
      : '\n✅ DJ catalog + maps + lineup avatar metadata synced (CDN URLs).',
  );
  if (fromCloud) {
    console.log('   本地已与云端对齐，可重新跑 crawl / full-catalog（建议加 --skip-purge-stubs）');
  }
  console.log(
    'Tip: run `npm run db:sync-catalog:all -- --with-itinerary` to sync festival sessions too.',
  );
}

main().catch(async (error) => {
  console.error('❌ Sync failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
