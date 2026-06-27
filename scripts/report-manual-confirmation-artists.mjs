#!/usr/bin/env node
/**
 * Real solo artists in the catalog lineup that still lack mapped profile/genre data.
 * Combo / stage / contest billing rows are expanded and filtered internally.
 *
 * Usage:
 *   npm run db:report-manual-confirmation-artists
 *   npm run db:report-manual-confirmation-artists -- --json
 *   npm run db:report-manual-confirmation-artists -- --names-only
 */

import mongoose from 'mongoose';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  createDjModel,
  getCrawlConfig,
  loadAllCatalogLineupDisplayNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import {
  collectArtistsMissingRealProfile,
  collectRealSoloArtistTargets,
} from './lib/lineup-real-artist-catalog.mjs';

loadDotEnv();

const asJson = process.argv.includes('--json');
const namesOnly = process.argv.includes('--names-only');

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const mapCol = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);

  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  const realSoloTargets = collectRealSoloArtistTargets(displayNames);
  const maps = await mapCol.find({}).toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));
  const djs = await Dj.find({}).lean();
  const djById = new Map(djs.map((row) => [row.discogsId, row]));

  const artists = collectArtistsMissingRealProfile({
    displayNames,
    mapByKey,
    djById,
  });

  await mongoose.disconnect();

  const report = {
    generatedAt: new Date().toISOString(),
    lineupDisplayCount: displayNames.length,
    realSoloTargetCount: realSoloTargets.length,
    missingRealProfileCount: artists.length,
    artists,
  };

  if (namesOnly) {
    for (const artist of artists) {
      console.log(artist.lineupName);
    }
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log(`\n阵容录入名: ${report.lineupDisplayCount}`);
  console.log(`真实 solo 艺人（内部拆分后）: ${report.realSoloTargetCount}`);
  console.log(`缺少 mapped 真实资料: ${report.missingRealProfileCount}\n`);

  for (const artist of artists) {
    const hints = [
      artist.issue,
      artist.discogsId ? `#${artist.discogsId} ${artist.discogsName ?? ''}`.trim() : null,
      artist.topCandidates ? `candidates=${artist.topCandidates}` : null,
      artist.reviewReason ? `reason=${artist.reviewReason}` : null,
    ]
      .filter(Boolean)
      .join(' | ');
    console.log(`- ${artist.lineupName}${hints ? ` | ${hints}` : ''}`);
  }
}

main().catch((error) => {
  console.error('❌ report-manual-confirmation-artists failed:', error.message ?? error);
  process.exit(1);
});
