#!/usr/bin/env node
/**
 * One-off partner/post legacy migrations (formerly PostService.onModuleInit).
 *
 * Usage:
 *   npm run db:migrate-partner:dry-run
 *   MONGODB_URI='mongodb://...' CONFIRM=1 npm run db:migrate-partner
 *
 * Options:
 *   --dry-run   Print what would change without writing.
 */

import mongoose from 'mongoose';
import { maskMongoUri } from './lib/reset-attendees.util.mjs';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const dryRun = process.argv.includes('--dry-run');
const confirmed = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';

const LEGACY_COLLECTIONS = [
  'userblocks',
  'postapplications',
  'postapplicationmessages',
  'postlikes',
];

const LEGACY_LIKES_INDEX = 'status_1_likes_-1_createdAt_-1';

async function countDocuments(collection, filter = {}) {
  try {
    return await collection.countDocuments(filter);
  } catch {
    return 0;
  }
}

async function migrateLegacyPostStatus(posts, { dryRun: preview }) {
  const completedFilter = { status: 'completed' };
  const recruitingFilter = { status: 'recruiting' };
  const completedCount = await countDocuments(posts, completedFilter);
  const recruitingCount = await countDocuments(posts, recruitingFilter);

  if (preview) {
    return {
      step: 'migrateLegacyPostStatus',
      wouldModify: completedCount + recruitingCount,
      detail: { completed: completedCount, recruiting: recruitingCount },
    };
  }

  const completed = await posts.updateMany(completedFilter, {
    $set: { status: 'active' },
  });
  const recruiting = await posts.updateMany(recruitingFilter, {
    $set: { status: 'active' },
  });
  const modified =
    (completed.modifiedCount ?? 0) + (recruiting.modifiedCount ?? 0);
  return { step: 'migrateLegacyPostStatus', modified };
}

async function migrateRemoveLegacyPostCounters(posts, db, { dryRun: preview }) {
  const likesFilter = { likes: { $exists: true } };
  const likesCount = await countDocuments(posts, likesFilter);

  const indexes = await posts.indexes();
  const hasLikesIndex = indexes.some(
    (index) => index.name === LEGACY_LIKES_INDEX,
  );

  if (preview) {
    return {
      step: 'migrateRemoveLegacyPostCounters',
      wouldUnsetLikes: likesCount,
      wouldDropIndex: hasLikesIndex ? LEGACY_LIKES_INDEX : null,
    };
  }

  const result = await posts.updateMany(likesFilter, { $unset: { likes: '' } });
  let indexDropped = false;
  if (hasLikesIndex) {
    try {
      await posts.dropIndex(LEGACY_LIKES_INDEX);
      indexDropped = true;
    } catch {
      // Index may already be dropped.
    }
  }
  return {
    step: 'migrateRemoveLegacyPostCounters',
    modified: result.modifiedCount ?? 0,
    indexDropped,
  };
}

async function purgeLegacyCollections(db, { dryRun: preview }) {
  const existing = await db.listCollections().toArray();
  const names = new Set(existing.map((item) => item.name));
  const targets = LEGACY_COLLECTIONS.filter((name) => names.has(name));

  if (preview) {
    return {
      step: 'purgeLegacyCollections',
      wouldDrop: targets,
    };
  }

  const dropped = [];
  for (const name of targets) {
    try {
      await db.dropCollection(name);
      dropped.push(name);
    } catch (error) {
      const codeName = error?.codeName;
      if (codeName !== 'NamespaceNotFound') {
        throw error;
      }
    }
  }
  return { step: 'purgeLegacyCollections', dropped };
}

async function purgePostsForRemovedActivities(posts, db, { dryRun: preview }) {
  const activities = db.collection('activities');
  const activityDocs = await activities
    .find({}, { projection: { legacyId: 1 } })
    .toArray();
  const validLegacyIds = activityDocs
    .map((doc) => doc.legacyId)
    .filter((id) => id != null);

  const orphanFilter = {
    activityLegacyId: { $exists: true, $nin: validLegacyIds },
  };
  const orphanCount = await countDocuments(posts, orphanFilter);

  if (preview) {
    return {
      step: 'purgePostsForRemovedActivities',
      validActivityCount: validLegacyIds.length,
      wouldDelete: orphanCount,
    };
  }

  const result = await posts.deleteMany(orphanFilter);
  return {
    step: 'purgePostsForRemovedActivities',
    deleted: result.deletedCount ?? 0,
  };
}

async function main() {
  console.log(`MongoDB: ${maskMongoUri(uri)}`);
  console.log(
    dryRun
      ? 'Mode: dry-run'
      : confirmed
        ? 'Mode: APPLY'
        : 'Mode: preview (set CONFIRM=1 to apply)',
  );
  console.log('');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const posts = db.collection('posts');

  const steps = [
    () => migrateLegacyPostStatus(posts, { dryRun }),
    () => migrateRemoveLegacyPostCounters(posts, db, { dryRun }),
    () => purgeLegacyCollections(db, { dryRun }),
    () => purgePostsForRemovedActivities(posts, db, { dryRun }),
  ];

  for (const runStep of steps) {
    const result = await runStep();
    console.log(JSON.stringify(result, null, 2));
  }

  if (dryRun) {
    console.log('');
    console.log('Dry-run only — no data changed.');
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    console.log('');
    console.log('Aborted. Re-run with CONFIRM=1 to apply migrations.');
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log('');
  console.log('✅ Partner legacy migrations applied.');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Partner migration failed:', error.message ?? error);
  process.exit(1);
});
