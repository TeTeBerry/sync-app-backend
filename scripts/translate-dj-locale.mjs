#!/usr/bin/env node
/**
 * Backfill Chinese `country` and `profileZh` for existing `djs` documents (single DB).
 *
 * Usage:
 *   npm run db:translate-dj-locale
 *   npm run db:translate-dj-locale:all   # translate + sync local & cloud
 */

import { loadDotEnv } from './lib/discogs-crawl.mjs';
import { maskMongoUri, resolveSourceMongoUri } from './lib/mongo-sync-targets.mjs';
import { runTranslateDjProfileLocale } from './lib/translate-dj-profile-locale.mjs';

loadDotEnv();

async function main() {
  const mongoUri = resolveSourceMongoUri();
  console.log(`\n=== Translate (${maskMongoUri(mongoUri)}) ===`);
  const result = await runTranslateDjProfileLocale(mongoUri);
  console.log(
    `\n🏁 完成：处理 ${result.processed} 条，更新 ${result.updated} 条`,
  );
  console.log('Tip: run `npm run db:translate-dj-locale:all` to sync local + cloud.');
}

main().catch((error) => {
  console.error('❌ 失败:', error.message ?? error);
  process.exit(1);
});
