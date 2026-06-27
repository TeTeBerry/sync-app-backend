#!/usr/bin/env node
/**
 * Rebuild `djs` rows for hermes-v4-web mapped artists from stored hermesEvidence.
 *
 * Usage:
 *   npm run db:rebuild-web-only-djs:dry-run
 *   CONFIRM=1 npm run db:rebuild-web-only-djs
 */

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDjModel,
  loadDotEnv,
  upsertDjRecord,
} from './lib/discogs-crawl.mjs';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  buildWebOnlyDjRecord,
  isHermesWebOnlyMap,
  precomputeDisplayGenresFromHermesEvidence,
} from './lib/web-only-dj-profile.mjs';
import { readEnvValue } from './lib/parse-env-file.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

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
  const Dj = createDjModel(mongoose);
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;

  const rows = await mapCollection
    .find({
      status: 'mapped',
      source: 'hermes-v4-web',
      hermesEvidence: { $exists: true, $ne: null },
    })
    .toArray();

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (!isHermesWebOnlyMap(row) || !row.hermesEvidence) {
      skipped += 1;
      continue;
    }

    const record = buildWebOnlyDjRecord({
      lineupName: row.lineupName,
      discogsName: row.discogsName,
      discogsId: row.discogsId,
      hermesEvidence: row.hermesEvidence,
    });

    const hadGenres = (record.genres ?? []).length > 0;
    console.log(
      `${dryRun ? '[dry-run] ' : ''}${row.lineupName}: genres=${record.genres.join(', ') || '(empty)'} profile=${record.profile ? 'yes' : 'no'}`,
    );

    if (!hadGenres && !record.profile) {
      skipped += 1;
      continue;
    }

    if (!dryRun) {
      await upsertDjRecord(Dj, record);
      const { displayGenres, displayStyles } =
        precomputeDisplayGenresFromHermesEvidence(row.hermesEvidence);
      await mapCollection.updateOne(
        { lineupNameKey: row.lineupNameKey },
        { $set: { displayGenres, displayStyles } },
      );
    }
    updated += 1;
  }

  if (!dryRun && updated > 0) {
    await bumpDjCatalogCacheVersion();
  }

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log(
    `\nDone. ${updated} rebuilt, ${skipped} skipped (${rows.length} hermes-v4-web rows scanned).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
