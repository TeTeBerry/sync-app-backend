#!/usr/bin/env node
/**
 * Export artists that v4 already researched (Discogs candidate) but still lack
 * mapped real profile data in Mongo.
 *
 * Usage:
 *   npm run db:export-v4-quick-confirm-artists
 *   npm run db:export-v4-quick-confirm-artists -- --json
 *   npm run db:export-v4-quick-confirm-artists -- --names-only
 *   npm run db:export-v4-quick-confirm-artists -- --v4-run ../hermes-agent/runs/v4-20260627-145342.json
 */

import mongoose from 'mongoose';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  createDjModel,
  getCrawlConfig,
  loadAllCatalogLineupDisplayNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { collectArtistsMissingRealProfile } from './lib/lineup-real-artist-catalog.mjs';
import {
  collectV4QuickConfirmArtists,
  resolveV4RunPathFromArgv,
} from './lib/v4-run-bundle-index.mjs';

loadDotEnv();

const asJson = process.argv.includes('--json');
const namesOnly = process.argv.includes('--names-only');

async function main() {
  const v4RunPath = resolveV4RunPathFromArgv();
  if (!v4RunPath) {
    throw new Error(
      'No v4 run JSON found. Pass --v4-run /path/to/v4-*.json',
    );
  }

  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  const mapCol = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);

  const maps = await mapCol.find({}).toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));
  const djs = await Dj.find({}).lean();
  const djById = new Map(djs.map((row) => [row.discogsId, row]));

  const missingArtists = collectArtistsMissingRealProfile({
    displayNames,
    mapByKey,
    djById,
  });

  const report = collectV4QuickConfirmArtists({
    missingArtists,
    v4RunPath,
  });

  await mongoose.disconnect();

  const payload = {
    generatedAt: new Date().toISOString(),
    missingRealProfileCount: missingArtists.length,
    v4RunPath: report.v4RunPath,
    v4RunId: report.v4RunId,
    v4FinishedAt: report.v4FinishedAt,
    quickConfirmCount: report.quickConfirm.length,
    v4WebOnlyCount: report.v4WebOnly.length,
    noV4MatchCount: report.noV4Match.length,
    quickConfirm: report.quickConfirm,
    v4WebOnly: report.v4WebOnly,
    noV4Match: report.noV4Match.map((row) =>
      typeof row === 'string' ? { lineupName: row } : row,
    ),
  };

  if (namesOnly) {
    for (const artist of report.quickConfirm) {
      console.log(artist.lineupName);
    }
    return;
  }

  if (asJson) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  console.log(`\nv4 跑批: ${payload.v4RunPath}`);
  console.log(`缺真实资料（总）: ${payload.missingRealProfileCount}`);
  console.log(`v4 已有 Discogs 候选、可快速落地: ${payload.quickConfirmCount}`);
  console.log(`v4 web-only（无 Discogs id）: ${payload.v4WebOnlyCount}`);
  console.log(`无 v4 记录 / no_match: ${payload.noV4MatchCount}\n`);

  if (report.quickConfirm.length) {
    console.log(`## 快速确认清单 (${report.quickConfirm.length})\n`);
    for (const artist of report.quickConfirm) {
      console.log(
        `- ${artist.lineupName} | ${artist.landingGap} | v4=${artist.v4Decision}/${artist.v4Confidence} | #${artist.v4DiscogsId} ${artist.v4DiscogsName}`,
      );
      if (artist.sourceDisplay && artist.matchedVia === 'expanded_from_display') {
        console.log(`  来自阵容行: ${artist.sourceDisplay}`);
      }
      if (artist.profileSnippet) {
        console.log(`  ${artist.profileSnippet}`);
      }
      console.log(`  → ${artist.action}`);
    }
    console.log('');
  }

  const batchNames = report.quickConfirm
    .map((artist) => artist.lineupName)
    .slice(0, 25)
    .join(',');
  if (batchNames) {
    console.log('批量 crawl 示例（前 25 人）:');
    console.log(`npm run db:crawl-catalog-artists -- --names "${batchNames}"`);
  }
}

main().catch((error) => {
  console.error('❌ export-v4-quick-confirm-artists failed:', error.message ?? error);
  process.exit(1);
});
