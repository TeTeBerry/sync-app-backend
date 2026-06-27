#!/usr/bin/env node
/**
 * Sync Discogs DJ catalog + lineup avatar metadata to local + cloud MongoDB.
 * Avatar URLs are public HTTPS CDN links (Discogs / TheAudioDB); this script copies metadata only.
 *
 * Usage:
 *   npm run db:sync-lineup-artist-catalog:all
 *   SOURCE_MONGODB_URI='mongodb://127.0.0.1:27017/sync-ai' npm run db:sync-lineup-artist-catalog:all
 *   npm run db:sync-lineup-artist-catalog:all -- --cloud-only
 *   npm run db:sync-lineup-artist-catalog:all -- --cloud-only --mirror
 *     # upsert then delete cloud rows not present in source (full-catalog uses this)
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

function resolveSourceUri() {
  return (
    process.env.SOURCE_MONGODB_URI ??
    process.env.LOCAL_MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai'
  );
}

function resolveTargets() {
  const syncLocal = process.argv.includes('--with-local');
  const cloudOnly = process.argv.includes('--cloud-only');
  const localOnly = process.argv.includes('--local-only');
  const targets = [];

  const localUri =
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai';

  const cloudUri =
    process.env.CLOUD_MONGODB_URI ??
    readEnvValue(path.join(ROOT, '.env.production'), 'MONGODB_URI');

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
  const [djs, avatars] = await Promise.all([
    db.collection('djs').find({}).toArray(),
    db.collection('lineup_artist_avatars').find({}).toArray(),
  ]);
  await mongoose.disconnect();
  return { djs, avatars };
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
  const mirror = process.argv.includes('--mirror');
  const sourceUri = resolveSourceUri();
  const targets = resolveTargets();

  console.log(`\n=== Loading source (${maskUri(sourceUri)}) ===`);
  const { djs, avatars } = await loadSourceCollections(sourceUri);
  console.log(`📀 djs: ${djs.length}`);
  console.log(`🖼️  lineup_artist_avatars: ${avatars.length}`);
  if (mirror) {
    console.log('🪞 mirror mode: targets will match source exactly (delete extras)');
  }

  for (const target of targets) {
    console.log(`\n=== Syncing to ${target.label} (${maskUri(target.uri)}) ===`);
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
      ? '\n✅ DJ catalog + avatars mirrored to target(s) from source.'
      : '\n✅ DJ catalog + lineup avatar metadata synced (CDN URLs).',
  );
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
