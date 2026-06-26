#!/usr/bin/env node
/**
 * Sync Discogs DJ catalog + lineup avatar metadata to local + cloud MongoDB.
 * Avatar URLs are public HTTPS CDN links (Discogs / TheAudioDB); this script copies metadata only.
 * keys so production can resolve HTTPS URLs.
 *
 * Usage:
 *   npm run db:sync-lineup-artist-catalog:all
 *   SOURCE_MONGODB_URI='mongodb://127.0.0.1:27017/sync-ai' npm run db:sync-lineup-artist-catalog:all
 *   npm run db:sync-lineup-artist-catalog:all -- --cloud-only
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

async function main() {
  const sourceUri = resolveSourceUri();
  const targets = resolveTargets();

  console.log(`\n=== Loading source (${maskUri(sourceUri)}) ===`);
  const { djs, avatars } = await loadSourceCollections(sourceUri);
  console.log(`📀 djs: ${djs.length}`);
  console.log(`🖼️  lineup_artist_avatars: ${avatars.length}`);

  for (const target of targets) {
    console.log(`\n=== Syncing to ${target.label} (${maskUri(target.uri)}) ===`);
    const djResult = await upsertDjs(target.uri, djs);
    console.log(
      `✅ djs: upserted ${djResult.upserted}, collection total ${djResult.total}`,
    );
    const avatarResult = await upsertAvatars(target.uri, avatars);
    console.log(
      `✅ lineup_artist_avatars: upserted ${avatarResult.upserted}, collection total ${avatarResult.total}`,
    );
  }

  console.log(
    '\n✅ DJ catalog + lineup avatar metadata synced. Avatar files are in CloudBase (shared).',
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
