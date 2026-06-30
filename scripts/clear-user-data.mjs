#!/usr/bin/env node
/**
 * Delete one user's app data (subscriptions, activities engagement, posts, etc.)
 * and reset buddy-match prefs (city / favorGenres / budgetLevel) on users.
 *
 * Usage:
 *   node scripts/clear-user-data.mjs --handle owXzyxYhL_
 *   node scripts/clear-user-data.mjs --name '阿闪片酱H4DU'
 *   CONFIRM=1 node scripts/clear-user-data.mjs --handle owXzyxYhL_
 *   node scripts/clear-user-data.mjs --handle owXzyxYhL_ --dry-run
 */

import mongoose from 'mongoose';
import { maskMongoUri } from './lib/reset-attendees.util.mjs';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const dryRun = process.argv.includes('--dry-run');
const confirmed = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';

function readArg(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function normalizeHandle(value) {
  const trimmed = value?.trim();
  if (!trimmed) return '';
  return trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}

async function deleteMany(collection, filter, label) {
  const count = await collection.countDocuments(filter);
  if (count === 0) {
    return { label, deleted: 0 };
  }
  if (dryRun || !confirmed) {
    return { label, deleted: count, preview: true };
  }
  const result = await collection.deleteMany(filter);
  return { label, deleted: result.deletedCount ?? count };
}

async function syncAttendeeCounts(db, activityLegacyIds) {
  if (!activityLegacyIds.length) return 0;
  const registrations = db.collection('activityregistrations');
  const activities = db.collection('activities');
  let updated = 0;

  for (const legacyId of activityLegacyIds) {
    const attendees = await registrations.countDocuments({
      activityLegacyId: legacyId,
      status: 'registered',
    });
    if (dryRun || !confirmed) {
      updated += 1;
      continue;
    }
    await activities.updateOne({ legacyId }, { $set: { attendees } });
    updated += 1;
  }
  return updated;
}

function hasBuddyPrefs(user) {
  return Boolean(
    user?.city?.trim() ||
      (user?.favorGenres?.length ?? 0) > 0 ||
      user?.budgetLevel?.trim(),
  );
}

async function resetUserBuddyPreferences(users, userFilter) {
  const doc = await users.findOne(userFilter);
  if (!doc || !hasBuddyPrefs(doc)) {
    return { label: 'users.buddy_prefs', deleted: 0 };
  }
  if (dryRun || !confirmed) {
    return { label: 'users.buddy_prefs', deleted: 1, preview: true };
  }
  await users.updateOne(userFilter, {
    $unset: { city: '', favorGenres: '', budgetLevel: '' },
  });
  return { label: 'users.buddy_prefs', deleted: 1 };
}

async function main() {
  const handle = normalizeHandle(readArg('--handle'));
  const name = readArg('--name')?.trim();
  const externalId = readArg('--user-id')?.trim();

  if (!handle && !name && !externalId) {
    console.error('Provide --handle, --name, or --user-id');
    process.exit(1);
  }

  console.log(`MongoDB: ${maskMongoUri(uri)}`);
  console.log(
    dryRun
      ? 'Mode: dry-run'
      : confirmed
        ? 'Mode: DELETE'
        : 'Mode: preview (set CONFIRM=1 to delete)',
  );
  console.log('');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const users = db.collection('users');

  let user = null;
  if (externalId) {
    user =
      (await users.findOne({ externalId })) ??
      (await users.findOne({ _id: externalId }));
  }
  if (!user && handle) {
    user = await users.findOne({
      $or: [
        { handle: `@${handle}` },
        { handle },
        { handle: new RegExp(handle, 'i') },
      ],
    });
  }
  if (!user && name) {
    user = await users.findOne({ name });
  }

  if (!user) {
    console.error('User not found.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const userId = user.externalId?.trim() || String(user._id);
  const authorName = user.name?.trim();
  const userFilter = user.externalId
    ? { externalId: user.externalId }
    : { _id: user._id };

  console.log('User:');
  console.log(`  name: ${user.name ?? ''}`);
  console.log(`  handle: ${user.handle ?? ''}`);
  console.log(`  userId: ${userId}`);
  console.log('');

  const registrationFilter = {
    $or: [{ userId }, ...(authorName ? [{ authorName }] : [])],
  };
  const registrations = db.collection('activityregistrations');
  const regRows = await registrations.find(registrationFilter).toArray();
  const activityLegacyIds = [
    ...new Set(
      regRows
        .map((row) => row.activityLegacyId)
        .filter((id) => Number.isFinite(id)),
    ),
  ];

  const postIds = (
    await db.collection('posts').find({ userId }).project({ _id: 1 }).toArray()
  ).map((row) => row._id);

  const ops = [
    deleteMany(
      db.collection('activityregistrations'),
      registrationFilter,
      'activityregistrations',
    ),
    deleteMany(db.collection('user_goals'), { userId }, 'user_goals'),
    deleteMany(
      db.collection('user_goal_artifacts'),
      { userId },
      'user_goal_artifacts',
    ),
    deleteMany(
      db.collection('activitysetvotes'),
      { userId },
      'activitysetvotes',
    ),
    deleteMany(
      db.collection('user_itineraries'),
      { userId },
      'user_itineraries',
    ),
    deleteMany(
      db.collection('user_travel_plans'),
      { userId },
      'user_travel_plans',
    ),
    deleteMany(db.collection('posts'), { userId }, 'posts'),
    deleteMany(
      db.collection('postcomments'),
      postIds.length
        ? { $or: [{ userId }, { postId: { $in: postIds.map(String) } }] }
        : { userId },
      'postcomments',
    ),
    deleteMany(
      db.collection('travel_guide_saved_plans'),
      { ownerUserId: userId },
      'travel_guide_saved_plans',
    ),
    deleteMany(
      db.collection('travel_guide_generation_jobs'),
      { ownerUserId: userId },
      'travel_guide_generation_jobs',
    ),
    deleteMany(
      db.collection('itinerary_generation_logs'),
      { userId },
      'itinerary_generation_logs',
    ),
    deleteMany(db.collection('notifications'), { userId }, 'notifications'),
    deleteMany(
      db.collection('user_personality_test_results'),
      { userId },
      'user_personality_test_results',
    ),
    deleteMany(db.collection('userfeedbacks'), { userId }, 'userfeedbacks'),
    deleteMany(
      db.collection('travel_plan_receipt_recognize_jobs'),
      { userId },
      'travel_plan_receipt_recognize_jobs',
    ),
    deleteMany(db.collection('chats'), { userId }, 'chats'),
  ];

  const results = [];
  for (const op of ops) {
    results.push(await op);
  }
  results.push(await resetUserBuddyPreferences(users, userFilter));

  for (const row of results) {
    const suffix = row.preview ? ' (would delete)' : '';
    console.log(`  ${row.label}: ${row.deleted}${suffix}`);
  }

  const attendeeSyncCount = await syncAttendeeCounts(db, activityLegacyIds);
  console.log('');
  console.log(
    `Attendee recount for ${attendeeSyncCount} activities${
      dryRun || !confirmed ? ' (preview)' : ''
    }`,
  );

  if (!dryRun && confirmed) {
    console.log('');
    console.log(
      '✅ User data cleared. Clear mini-program cache / re-login on device.',
    );
  } else if (!dryRun && !confirmed) {
    console.log('');
    console.log('Preview only — re-run with CONFIRM=1 to delete.');
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Failed:', error.message ?? error);
  process.exit(1);
});
