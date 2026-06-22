#!/usr/bin/env node
/**
 * Sync activity catalog to local + cloud MongoDB.
 *
 * Usage:
 *   npm run db:sync-catalog:all
 *   CLOUD_MONGODB_URI='mongodb://...' npm run db:sync-catalog:all
 *   npm run db:sync-catalog:all -- --with-itinerary
 *
 * Env:
 *   LOCAL_MONGODB_URI  default mongodb://127.0.0.1:27017/sync-ai
 *   CLOUD_MONGODB_URI  or MONGODB_URI from .env.production
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadDotEnv } from './lib/discogs-crawl.mjs';
import { readEnvValue } from './lib/parse-env-file.mjs';
import { syncActivityCatalog } from './lib/sync-activity-catalog-core.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

loadDotEnv();

function maskUri(uri) {
  return uri.replace(/:[^:@/]+@/, ':***@');
}

function resolveTargets() {
  const localOnly = process.argv.includes('--local-only');
  const cloudOnly = process.argv.includes('--cloud-only');
  const targets = [];

  const localUri =
    process.env.LOCAL_MONGODB_URI ??
    process.env.MONGODB_URI ??
    'mongodb://127.0.0.1:27017/sync-ai';

  const cloudUri =
    process.env.CLOUD_MONGODB_URI ??
    readEnvValue(path.join(ROOT, '.env.production'), 'MONGODB_URI');

  if (!cloudOnly) {
    targets.push({ label: 'local', uri: localUri });
  }
  if (!localOnly && cloudUri) {
    targets.push({ label: 'cloud', uri: cloudUri });
  }

  if (targets.length === 0) {
    throw new Error(
      'No MongoDB targets. Set LOCAL_MONGODB_URI / CLOUD_MONGODB_URI or add .env.production',
    );
  }

  return targets;
}

async function seedItinerary(uri) {
  execSync('node scripts/seed-itinerary-catalog.mjs', {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, MONGODB_URI: uri },
  });
}

async function main() {
  const withItinerary = process.argv.includes('--with-itinerary');
  const targets = resolveTargets();

  for (const target of targets) {
    console.log(`\n=== Syncing activity catalog (${target.label}) ===`);
    console.log(`    ${maskUri(target.uri)}`);
    const result = await syncActivityCatalog(target.uri);
    console.log(`✅ ${target.label}: upserted ${result.upserted}, removed ${result.removedDeprecated}`);
    for (const activity of result.activities) {
      console.log(
        `   [${activity.legacyId}] attendees=${activity.attendees}, recruitPosts=${activity.recruitPostCount}`,
      );
    }

    if (withItinerary) {
      console.log(`→ Seeding itinerary (${target.label})…`);
      await seedItinerary(target.uri);
    }
  }

  console.log('\n✅ All activity catalog targets synced.');
  if (!withItinerary) {
    console.log('Tip: add --with-itinerary to sync lineup sessions/performances too.');
  }
  console.log('Restart backend (or wait for cache refresh) so API picks up recruitPostCount.');
}

main().catch((error) => {
  console.error('❌ Sync failed:', error.message ?? error);
  process.exit(1);
});
