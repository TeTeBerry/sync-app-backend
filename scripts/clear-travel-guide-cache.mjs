#!/usr/bin/env node
/**
 * Clear cached travel guides so the next generate hits RollingGo / full pipeline.
 *
 * Usage:
 *   node scripts/clear-travel-guide-cache.mjs
 *   node scripts/clear-travel-guide-cache.mjs --activity=4
 *   MONGODB_URI='...' node scripts/clear-travel-guide-cache.mjs
 */

import mongoose from 'mongoose';
import { maskMongoUri } from './lib/reset-attendees.util.mjs';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const activityArg = process.argv.find((a) => a.startsWith('--activity='));
const activityLegacyId = activityArg
  ? Number(activityArg.split('=')[1])
  : undefined;

const COLLECTIONS = [
  'travel_guide_generation_cache',
  'travel_guide_saved_plans',
  'travel_guide_generation_jobs',
];

async function clearCollection(db, name) {
  const collection = db.collection(name);
  const filter =
    activityLegacyId != null && !Number.isNaN(activityLegacyId)
      ? { activityLegacyId }
      : {};
  const before = await collection.countDocuments(filter);
  const result = await collection.deleteMany(filter);
  return { name, before, deleted: result.deletedCount ?? 0, filter };
}

async function main() {
  console.log(`MongoDB: ${maskMongoUri(uri)}`);
  if (activityLegacyId != null && !Number.isNaN(activityLegacyId)) {
    console.log(`Scope: activityLegacyId=${activityLegacyId}`);
  } else {
    console.log('Scope: all activities');
  }
  console.log('');

  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const name of COLLECTIONS) {
    const { before, deleted, filter } = await clearCollection(db, name);
    const scope =
      Object.keys(filter).length > 0
        ? ` (activityLegacyId=${filter.activityLegacyId})`
        : '';
    console.log(`✓ ${name}: deleted ${deleted} / ${before}${scope}`);
  }

  console.log('');
  console.log('Done. Restart backend if running, then regenerate a cross-city travel guide.');
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Clear failed:', error.message ?? error);
  process.exit(1);
});
