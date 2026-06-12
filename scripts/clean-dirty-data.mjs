#!/usr/bin/env node
/**
 * Remove user-generated / operational data from MongoDB.
 * Keeps activity catalog + lineup collections only.
 *
 * Usage:
 *   npm run db:clean-dirty:dry-run
 *   MONGODB_URI='mongodb://...' CONFIRM=1 npm run db:clean-dirty
 *
 * Options:
 *   --dry-run   Print what would be deleted without writing.
 */

import mongoose from 'mongoose';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const dryRun = process.argv.includes('--dry-run');
const confirmed = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';

/** Catalog data tied to festivals / activities — never deleted by this script. */
const KEEP_COLLECTIONS = new Set([
  'activities',
  'festival_sessions',
  'artist_performances',
  'djs',
  'travel_guide_venue_cache',
]);

function maskUri(value) {
  return value.replace(/:([^:@/]+)@/, ':***@');
}

async function countDocuments(collection) {
  try {
    return await collection.countDocuments();
  } catch {
    return 0;
  }
}

/** Wipe registrations and zero out per-activity attendee totals. */
async function resetAttendeeCounts(db, { dryRun = false } = {}) {
  const activities = db.collection('activities');
  const registrations = db.collection('activityregistrations');

  const registrationCount = await countDocuments(registrations);
  const activityCount = await countDocuments(activities);

  if (dryRun) {
    console.log('');
    console.log('Would reset attendee counts:');
    console.log(`  activityregistrations delete: ${registrationCount}`);
    console.log(`  activities.attendees → 0: ${activityCount}`);
    return { registrationCount, activityCount };
  }

  const regResult = await registrations.deleteMany({});
  const actResult = await activities.updateMany({}, { $set: { attendees: 0 } });

  console.log(`  cleared activityregistrations: ${regResult.deletedCount ?? registrationCount}`);
  console.log(
    `  reset activities.attendees → 0: ${actResult.modifiedCount ?? activityCount}`,
  );

  return {
    registrationCount: regResult.deletedCount ?? registrationCount,
    activityCount: actResult.modifiedCount ?? activityCount,
  };
}

async function main() {
  console.log(`MongoDB: ${maskUri(uri)}`);
  console.log(dryRun ? 'Mode: dry-run' : confirmed ? 'Mode: DELETE' : 'Mode: preview (set CONFIRM=1 to delete)');
  console.log('');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const existing = await db.listCollections().toArray();
  const names = existing.map((item) => item.name).sort();

  const toDelete = names.filter((name) => !KEEP_COLLECTIONS.has(name));
  const kept = names.filter((name) => KEEP_COLLECTIONS.has(name));

  console.log('Keep:');
  for (const name of kept) {
    const count = await countDocuments(db.collection(name));
    console.log(`  ✓ ${name} (${count})`);
  }

  console.log('');
  console.log(dryRun || !confirmed ? 'Would delete:' : 'Deleting:');
  for (const name of toDelete) {
    const count = await countDocuments(db.collection(name));
    console.log(`  ✗ ${name} (${count})`);
  }

  if (dryRun) {
    await resetAttendeeCounts(db, { dryRun: true });
    console.log('');
    console.log('Dry-run only — no data changed.');
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    console.log('');
    console.log('Aborted. Re-run with CONFIRM=1 to delete the collections above.');
    await mongoose.disconnect();
    process.exit(1);
  }

  let deletedCollections = 0;
  let deletedDocuments = 0;

  for (const name of toDelete) {
    const collection = db.collection(name);
    const count = await countDocuments(collection);
    const result = await collection.deleteMany({});
    deletedCollections += 1;
    deletedDocuments += result.deletedCount ?? count;
    console.log(`  deleted ${name}: ${result.deletedCount ?? count}`);
  }

  console.log('');
  console.log('Reset attendee counts:');
  await resetAttendeeCounts(db);

  console.log('');
  console.log('✅ Dirty data removed');
  console.log(`   collections cleared: ${deletedCollections}`);
  console.log(`   documents deleted: ${deletedDocuments}`);
  console.log('');
  console.log('Next (optional):');
  console.log('  npm run db:sync-catalog');
  console.log('  npm run db:seed-itinerary');

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Clean failed:', error.message ?? error);
  process.exit(1);
});
