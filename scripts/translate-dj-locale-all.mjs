#!/usr/bin/env node
/**
 * Translate DJ profiles on source DB, then sync profileZh to local + cloud.
 *
 * Usage:
 *   npm run db:translate-dj-locale:all
 *   DJ_TRANSLATE_LIMIT=20 npm run db:translate-dj-locale:all
 *   npm run db:translate-dj-locale:all -- --cloud-only
 */

import { loadDotEnv } from './lib/discogs-crawl.mjs';
import {
  maskMongoUri,
  resolveLocalAndCloudTargets,
  resolveSourceMongoUri,
} from './lib/mongo-sync-targets.mjs';
import { syncDjProfileLocale } from './lib/sync-dj-profile-locale-core.mjs';
import { runTranslateDjProfileLocale } from './lib/translate-dj-profile-locale.mjs';

loadDotEnv();

async function main() {
  const sourceUri = resolveSourceMongoUri();
  const targets = resolveLocalAndCloudTargets();

  console.log(`\n=== Step 1: Translate on source (${maskMongoUri(sourceUri)}) ===`);
  const translateResult = await runTranslateDjProfileLocale(sourceUri);
  console.log(
    `🏁 Translate done: processed ${translateResult.processed}, updated ${translateResult.updated}`,
  );

  console.log('\n=== Step 2: Sync profileZh to local + cloud ===');
  const { rows, results } = await syncDjProfileLocale(sourceUri, targets);
  console.log(`📀 profile locale rows in source: ${rows}`);

  for (const result of results) {
    const targetUri = targets.find((target) => target.label === result.label)?.uri ?? '';
    console.log(`\n--- ${result.label} (${maskMongoUri(targetUri)}) ---`);
    console.log(
      `✅ updated ${result.upserted} djs; collection has ${result.withZh} with profileZh`,
    );
  }

  console.log('\n✅ DJ profile locale translated and synced.');
}

main().catch((error) => {
  console.error('❌ Failed:', error.message ?? error);
  process.exit(1);
});
