#!/usr/bin/env node
/**
 * Upsert 2026 festival catalog and remove retired festivals from MongoDB.
 *
 * Usage:
 *   npm run db:sync-catalog
 *   MONGODB_URI=mongodb://127.0.0.1:27017/sync-ai node scripts/sync-activity-catalog.mjs
 */

import { loadDotEnv } from './lib/discogs-crawl.mjs';
import { syncActivityCatalog } from './lib/sync-activity-catalog-core.mjs';

loadDotEnv();

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

async function main() {
  const result = await syncActivityCatalog(uri);

  console.log('✅ Activity catalog synced');
  console.log(`   target: ${uri.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`   upserted: ${result.upserted} festivals`);
  console.log(`   removed deprecated: ${result.removedDeprecated}`);
  console.log('   catalog snapshot:');
  for (const activity of result.activities) {
    console.log(
      `     - [${activity.legacyId}] ${activity.name}: attendees=${activity.attendees}`,
    );
  }
}

main().catch((error) => {
  console.error('❌ Sync failed:', error.message ?? error);
  process.exit(1);
});
