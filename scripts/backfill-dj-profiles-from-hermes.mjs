#!/usr/bin/env node
/**
 * Patch `djs.profile` (and empty urls/country) from stored `hermesEvidence` on
 * Discogs-mapped rows. Web-only maps are handled by rebuild-web-only-djs.
 *
 * Usage:
 *   npm run db:backfill-dj-profiles-from-hermes:dry-run
 *   npm run db:backfill-dj-profiles-from-hermes
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { backfillDjProfilesFromHermes } from './lib/backfill-dj-profiles-from-hermes.mjs';
import { closeDjDiscogsRedisCache, loadDotEnv } from './lib/discogs-crawl.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadDotEnv();

const dryRun = process.argv.includes('--dry-run');

function resolveMongoUri() {
  return (
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai'
  );
}

async function main() {
  const uri = resolveMongoUri();
  await mongoose.connect(uri);

  const { updated, skipped, scanned } = await backfillDjProfilesFromHermes({
    mongoose,
    dryRun,
  });

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log(
    `\nDone. ${updated} patched, ${skipped} skipped (${scanned} mapped+hermes rows scanned).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
