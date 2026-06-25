#!/usr/bin/env node
/**
 * List all catalog lineup artist names (Mongo + seed fallback).
 * Used by hermes-agent via subprocess — same logic as db:crawl-catalog-artists scope.
 *
 * Usage:
 *   npm run db:list-catalog-lineup-artists
 *   MONGODB_URI=... node scripts/list-catalog-lineup-artists.mjs
 */

import mongoose from 'mongoose';
import {
  getCrawlConfig,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;

  const activities = await db
    .collection('activities')
    .find({})
    .project({ legacyId: 1 })
    .toArray();

  const artists = await loadAllCatalogLineupArtistNames(db, config);

  const payload = {
    source: 'backend',
    artists,
    artistCount: artists.length,
    activityCount: activities.length,
  };

  process.stdout.write(`${JSON.stringify(payload)}\n`);
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error('❌ list-catalog-lineup-artists failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
