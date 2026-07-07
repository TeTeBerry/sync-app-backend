#!/usr/bin/env node
/**
 * Mirror festival_sessions + artist_performances from local MongoDB to cloud.
 *
 * Usage:
 *   npm run db:sync-itinerary-lineup -- --activity-legacy-id=7 --cloud-only
 *   npm run db:sync-itinerary-lineup -- --cloud-only --mirror
 *   npm run db:sync-itinerary-lineup -- --activity-legacy-id=7 --cloud-only --invalidate-cache
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import Redis from 'ioredis';
import { loadDotEnv } from './lib/discogs-crawl.mjs';
import { readEnvValue } from './lib/parse-env-file.mjs';
import {
  maskMongoUri,
  resolveLocalAndCloudTargets,
  resolveSourceMongoUri,
} from './lib/mongo-sync-targets.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

loadDotEnv();

function parseActivityLegacyIds(argv) {
  const ids = argv
    .filter((arg) => arg.startsWith('--activity-legacy-id='))
    .map((arg) => Number(arg.split('=')[1]))
    .filter((id) => Number.isInteger(id) && id > 0);
  return [...new Set(ids)];
}

async function loadSourceLineup(sourceUri, activityLegacyIds) {
  await mongoose.connect(sourceUri);
  const db = mongoose.connection.db;
  const perfFilter =
    activityLegacyIds.length > 0
      ? { activityLegacyId: { $in: activityLegacyIds } }
      : {};
  const sessionFilter =
    activityLegacyIds.length > 0
      ? { activityLegacyId: { $in: activityLegacyIds } }
      : {};

  const [performances, sessions] = await Promise.all([
    db.collection('artist_performances').find(perfFilter).toArray(),
    db.collection('festival_sessions').find(sessionFilter).toArray(),
  ]);
  await mongoose.disconnect();
  return { performances, sessions };
}

async function upsertPerformances(uri, rows) {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('artist_performances');
  let upserted = 0;

  for (const row of rows) {
    const { _id, createdAt, ...payload } = row;
    void _id;
    if (
      !payload.activityLegacyId ||
      !payload.dateKey?.trim() ||
      !payload.artistId?.trim()
    ) {
      continue;
    }
    await collection.updateOne(
      {
        activityLegacyId: payload.activityLegacyId,
        dateKey: payload.dateKey,
        artistId: payload.artistId,
      },
      {
        $set: { ...payload, updatedAt: new Date() },
        $setOnInsert: { createdAt: createdAt ?? new Date() },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  const total = await collection.countDocuments();
  await mongoose.disconnect();
  return { upserted, total };
}

async function upsertSessions(uri, rows) {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('festival_sessions');
  let upserted = 0;

  for (const row of rows) {
    const { _id, createdAt, ...payload } = row;
    void _id;
    if (!payload.activityLegacyId || !payload.dateKey?.trim()) {
      continue;
    }
    await collection.updateOne(
      {
        activityLegacyId: payload.activityLegacyId,
        dateKey: payload.dateKey,
      },
      {
        $set: { ...payload, updatedAt: new Date() },
        $setOnInsert: { createdAt: createdAt ?? new Date() },
      },
      { upsert: true },
    );
    upserted += 1;
  }

  const total = await collection.countDocuments();
  await mongoose.disconnect();
  return { upserted, total };
}

async function mirrorPerformances(uri, rows, activityLegacyIds) {
  const keys = new Set(
    rows.map((row) => `${row.activityLegacyId}:${row.dateKey}:${row.artistId}`),
  );

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('artist_performances');
  const filter =
    activityLegacyIds.length > 0
      ? { activityLegacyId: { $in: activityLegacyIds } }
      : {};

  const existing = await collection.find(filter).toArray();
  const staleIds = existing
    .filter(
      (row) =>
        !keys.has(`${row.activityLegacyId}:${row.dateKey}:${row.artistId}`),
    )
    .map((row) => row._id);

  let deleted = 0;
  if (staleIds.length > 0) {
    const result = await collection.deleteMany({ _id: { $in: staleIds } });
    deleted = result.deletedCount ?? 0;
  }

  const total = await collection.countDocuments(filter);
  await mongoose.disconnect();
  return { deleted, total };
}

async function mirrorSessions(uri, rows, activityLegacyIds) {
  const keys = new Set(rows.map((row) => `${row.activityLegacyId}:${row.dateKey}`));

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('festival_sessions');
  const filter =
    activityLegacyIds.length > 0
      ? { activityLegacyId: { $in: activityLegacyIds } }
      : {};

  const existing = await collection.find(filter).toArray();
  const staleIds = existing
    .filter((row) => !keys.has(`${row.activityLegacyId}:${row.dateKey}`))
    .map((row) => row._id);

  let deleted = 0;
  if (staleIds.length > 0) {
    const result = await collection.deleteMany({ _id: { $in: staleIds } });
    deleted = result.deletedCount ?? 0;
  }

  const total = await collection.countDocuments(filter);
  await mongoose.disconnect();
  return { deleted, total };
}

async function invalidateScheduleCache(activityLegacyIds, sessions) {
  const redisUrl =
    process.env.CLOUD_REDIS_URL ??
    readEnvValue(path.join(ROOT, '.env.production'), 'REDIS_URL');

  if (!redisUrl) {
    console.warn('⚠️  REDIS_URL not set — skip cache invalidation');
    return;
  }

  const redis = new Redis(redisUrl);
  const activityIds =
    activityLegacyIds.length > 0
      ? activityLegacyIds
      : [...new Set(sessions.map((session) => session.activityLegacyId))];

  let deleted = 0;
  for (const activityLegacyId of activityIds) {
    const dateKeys = [
      'all',
      ...new Set(
        sessions
          .filter((session) => session.activityLegacyId === activityLegacyId)
          .map((session) => session.dateKey),
      ),
    ];
    for (const dateKey of dateKeys) {
      const key = `itinerary:schedule:v6:${activityLegacyId}:${dateKey}`;
      const result = await redis.del(key);
      deleted += result;
    }
  }

  await redis.quit();
  console.log(`   cache invalidated: ${deleted} key(s)`);
}

async function main() {
  const argv = process.argv.slice(2);
  const mirror = argv.includes('--mirror');
  const invalidateCache = argv.includes('--invalidate-cache');
  const activityLegacyIds = parseActivityLegacyIds(argv);
  const targets = resolveLocalAndCloudTargets(argv);
  const sourceUri = resolveSourceMongoUri();

  console.log(`Source: ${maskMongoUri(sourceUri)}`);
  if (activityLegacyIds.length > 0) {
    console.log(`Activities: ${activityLegacyIds.join(', ')}`);
  }

  const { performances, sessions } = await loadSourceLineup(
    sourceUri,
    activityLegacyIds,
  );
  console.log(
    `Loaded ${performances.length} performances, ${sessions.length} sessions`,
  );

  if (!performances.length && !sessions.length) {
    throw new Error('No itinerary lineup rows found in source MongoDB');
  }

  for (const target of targets) {
    console.log(`\n=== Syncing itinerary lineup (${target.label}) ===`);
    console.log(`    ${maskMongoUri(target.uri)}`);

    const perfResult = await upsertPerformances(target.uri, performances);
    const sessionResult = await upsertSessions(target.uri, sessions);
    console.log(
      `✅ performances upserted ${perfResult.upserted} (total ${perfResult.total})`,
    );
    console.log(
      `✅ sessions upserted ${sessionResult.upserted} (total ${sessionResult.total})`,
    );

    if (mirror) {
      const perfMirror = await mirrorPerformances(
        target.uri,
        performances,
        activityLegacyIds,
      );
      const sessionMirror = await mirrorSessions(
        target.uri,
        sessions,
        activityLegacyIds,
      );
      console.log(
        `   mirror deleted performances=${perfMirror.deleted}, sessions=${sessionMirror.deleted}`,
      );
    }
  }

  if (invalidateCache) {
    console.log('\n→ Invalidating itinerary schedule cache…');
    await invalidateScheduleCache(activityLegacyIds, sessions);
  } else {
    console.log(
      '\nTip: add --invalidate-cache to clear cloud itinerary schedule cache immediately.',
    );
  }

  console.log('\n✅ Itinerary lineup sync complete.');
}

main().catch((error) => {
  console.error('❌ Itinerary lineup sync failed:', error.message ?? error);
  process.exit(1);
});
