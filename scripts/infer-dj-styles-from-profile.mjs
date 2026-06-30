#!/usr/bin/env node
/**
 * Infer `djs.styles` / `displayGenres` from stored profile bio and Hermes evidence
 * when mapped artists have a profile but no specific catalog genres.
 *
 * Usage:
 *   npm run db:infer-dj-styles-from-profile:dry-run
 *   npm run db:infer-dj-styles-from-profile
 *   npm run db:infer-dj-styles-from-profile -- --names "WREX,STANNE"
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import { inferDjStylesFromProfile } from './lib/infer-dj-styles-from-profile.mjs';
import { closeDjDiscogsRedisCache, loadDotEnv } from './lib/discogs-crawl.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');

function readNamesArg() {
  const index = argv.indexOf('--names');
  if (index === -1) {
    return [];
  }
  return (
    argv[index + 1]
      ?.split(',')
      .map((name) => name.trim())
      .filter(Boolean) ?? []
  );
}

function resolveMongoUri() {
  return (
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai'
  );
}

async function main() {
  const lineupNames = readNamesArg();
  const uri = resolveMongoUri();
  await mongoose.connect(uri);

  const { updated, skipped, scanned } = await inferDjStylesFromProfile({
    mongoose,
    dryRun,
    lineupNames,
  });

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log(
    `\nDone. ${updated} patched, ${skipped} skipped (${scanned} mapped rows scanned).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
