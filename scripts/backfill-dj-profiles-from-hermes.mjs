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
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDjModel,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  buildHermesCatalogProfileText,
  isHermesWebOnlyMap,
} from './lib/web-only-dj-profile.mjs';

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

function collectUrls(hermesEvidence) {
  const urls = new Set();
  for (const row of hermesEvidence?.web ?? []) {
    if (row.url?.trim()) {
      urls.add(row.url.trim());
    }
  }
  if (hermesEvidence?.musicbrainz?.url?.trim()) {
    urls.add(hermesEvidence.musicbrainz.url.trim());
  }
  for (const fact of hermesEvidence?.sourcedFacts ?? []) {
    if (fact.sourceUrl?.trim()) {
      urls.add(fact.sourceUrl.trim());
    }
  }
  return [...urls];
}

function resolveCountry(sourcedFacts = []) {
  for (const fact of sourcedFacts) {
    if (/country|origin|based/i.test(fact.claim ?? '')) {
      const value = fact.value?.trim();
      if (value) {
        return value;
      }
    }
  }
  return '';
}

async function main() {
  const uri = resolveMongoUri();
  await mongoose.connect(uri);
  const Dj = createDjModel(mongoose);
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;

  const rows = await mapCollection
    .find({
      status: 'mapped',
      discogsId: { $exists: true, $ne: null },
      hermesEvidence: { $exists: true, $ne: null },
    })
    .toArray();

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    if (isHermesWebOnlyMap(row) || !row.hermesEvidence || !row.discogsId) {
      skipped += 1;
      continue;
    }

    const profile = buildHermesCatalogProfileText(row.hermesEvidence);
    if (!profile) {
      skipped += 1;
      continue;
    }

    const dj = await Dj.findOne({ discogsId: row.discogsId }).lean();
    if (!dj) {
      skipped += 1;
      continue;
    }

    if (dj.profile?.trim()) {
      skipped += 1;
      continue;
    }

    const patch = { profile };
    const country = resolveCountry(row.hermesEvidence.sourcedFacts);
    if (!dj.country?.trim() && country) {
      patch.country = country;
    }

    const extraUrls = collectUrls(row.hermesEvidence);
    if (extraUrls.length) {
      patch.urls = [...new Set([...(dj.urls ?? []), ...extraUrls])];
    }

    console.log(
      `${dryRun ? '[dry-run] ' : ''}${row.lineupName} → #${row.discogsId}: profile=${profile.slice(0, 60)}…`,
    );

    if (!dryRun) {
      await Dj.updateOne({ discogsId: row.discogsId }, { $set: patch });
    }
    updated += 1;
  }

  if (!dryRun && updated > 0) {
    await bumpDjCatalogCacheVersion();
  }

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log(
    `\nDone. ${updated} patched, ${skipped} skipped (${rows.length} mapped+hermes rows scanned).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
