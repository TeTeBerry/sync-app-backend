#!/usr/bin/env node
/**
 * Sync compound indexes declared in Mongoose schemas (idempotent).
 *
 * Usage:
 *   npm run db:sync-indexes
 *   MONGODB_URI='mongodb://...' npm run db:sync-indexes
 */

import mongoose from 'mongoose';
import { maskMongoUri } from './lib/mongo-sync-targets.mjs';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

/** Keep in sync with schema index names in src/database/schemas/*.ts */
const INDEX_SPECS = [
  {
    collection: 'notifications',
    key: { userId: 1, read: 1, createdAt: -1 },
    options: { name: 'notification_user_unread', background: true },
  },
  {
    collection: 'contentreports',
    key: { targetUserId: 1, category: 1, createdAt: -1 },
    options: {
      name: 'content_report_target_category',
      sparse: true,
      background: true,
    },
  },
  {
    collection: 'activityregistrations',
    key: { activityLegacyId: 1, status: 1, wechatActivityUpdateOptIn: 1 },
    options: { name: 'registration_activity_broadcast', background: true },
  },
  {
    collection: 'posts',
    key: { userId: 1, activityLegacyId: 1, status: 1, createdAt: -1 },
    options: { name: 'post_owner_activity_active', background: true },
  },
  {
    collection: 'festival_sessions',
    key: { activityLegacyId: 1, sortOrder: 1 },
    options: { name: 'festival_session_activity_sort', background: true },
  },
  {
    collection: 'travel_guide_generation_jobs',
    key: { ownerUserId: 1, dedupeKey: 1, status: 1 },
    options: { name: 'travel_guide_job_dedupe', background: true },
  },
  {
    collection: 'travel_guide_generation_jobs',
    key: { ownerUserId: 1, activityLegacyId: 1, status: 1, updatedAt: -1 },
    options: { name: 'travel_guide_job_latest_completed', background: true },
  },
  {
    collection: 'travel_guide_saved_plans',
    key: { ownerUserId: 1, activityLegacyId: 1, updatedAt: -1 },
    options: { name: 'travel_guide_saved_plan_latest', background: true },
  },
  {
    collection: 'accountriskevents',
    key: { userId: 1, severity: 1, createdAt: -1 },
    options: { name: 'account_risk_user_severity', background: true },
  },
];

async function main() {
  console.log(`MongoDB: ${maskMongoUri(uri)}`);
  await mongoose.connect(uri);
  const db = mongoose.connection.db;

  for (const spec of INDEX_SPECS) {
    const result = await db
      .collection(spec.collection)
      .createIndex(spec.key, spec.options);
    console.log(`${spec.collection}: ${result}`);
  }

  await mongoose.disconnect();
  console.log('Done.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
