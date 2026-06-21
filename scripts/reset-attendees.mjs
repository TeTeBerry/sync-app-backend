#!/usr/bin/env node
/**
 * Clear all activity registrations and reset attendees to 0.
 *
 * Usage:
 *   npm run db:reset-attendees:dry-run
 *   MONGODB_URI='mongodb://...' CONFIRM=1 npm run db:reset-attendees
 */

import mongoose from 'mongoose';
import {
  listActivityAttendees,
  maskMongoUri,
  resetAttendeeCounts,
} from './lib/reset-attendees.util.mjs';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const dryRun = process.argv.includes('--dry-run');
const confirmed = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';

async function main() {
  console.log(`MongoDB: ${maskMongoUri(uri)}`);
  console.log(
    dryRun ? 'Mode: dry-run' : confirmed ? 'Mode: RESET' : 'Mode: preview (set CONFIRM=1 to reset)',
  );

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  const activityRows = await listActivityAttendees(db);
  const registrationCount = await db
    .collection('activityregistrations')
    .countDocuments()
    .catch(() => 0);

  console.log('');
  console.log('Current attendees:');
  for (const row of activityRows) {
    console.log(`  ${row.legacyId} ${row.name}: ${row.attendees ?? 0}`);
  }
  console.log(`  registrations total: ${registrationCount}`);

  if (dryRun) {
    console.log('');
    console.log('Would delete all activityregistrations and set activities.attendees = 0');
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    console.log('');
    console.log('Aborted. Re-run with CONFIRM=1 to reset attendee counts.');
    await mongoose.disconnect();
    process.exit(1);
  }

  const result = await resetAttendeeCounts(db);

  console.log('');
  console.log('✅ Attendee counts reset');
  console.log(`   registrations deleted: ${result.registrationCount}`);
  console.log(`   activities updated: ${result.activityCount}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Reset failed:', error.message ?? error);
  process.exit(1);
});
