#!/usr/bin/env node
/**
 * Sync `profileZh` / `profileZhSource` / `country` from source MongoDB to local + cloud.
 *
 * Usage:
 *   npm run db:sync-dj-profile-locale:all
 *   SOURCE_MONGODB_URI='mongodb://127.0.0.1:27017/sync-ai' npm run db:sync-dj-profile-locale:all
 *   npm run db:sync-dj-profile-locale:all -- --cloud-only
 *   npm run db:sync-dj-profile-locale:all -- --local-only
 */

import { loadDotEnv } from './lib/discogs-crawl.mjs';
import {
  maskMongoUri,
  resolveLocalAndCloudTargets,
  resolveSourceMongoUri,
} from './lib/mongo-sync-targets.mjs';
import { syncDjProfileLocale } from './lib/sync-dj-profile-locale-core.mjs';

loadDotEnv();

async function main() {
  const sourceUri = resolveSourceMongoUri();
  const targets = resolveLocalAndCloudTargets();

  console.log(`\n=== Source (${maskMongoUri(sourceUri)}) ===`);
  const { rows, results } = await syncDjProfileLocale(sourceUri, targets);

  console.log(`📀 profile locale rows in source: ${rows}`);

  for (const result of results) {
    console.log(
      `\n=== ${result.label} (${maskMongoUri(targets.find((t) => t.label === result.label)?.uri ?? '')}) ===`,
    );
    console.log(
      `✅ updated ${result.upserted} djs; collection has ${result.withZh} with profileZh`,
    );
  }

  console.log('\n✅ DJ profile locale fields synced.');
}

main().catch((error) => {
  console.error('❌ Sync failed:', error.message ?? error);
  process.exit(1);
});
