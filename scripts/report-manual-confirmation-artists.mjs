#!/usr/bin/env node
/**
 * Real solo artists in the catalog lineup that still lack mapped profile/genre data.
 * Combo / stage / contest billing rows are expanded and filtered internally.
 *
 * Usage:
 *   npm run db:report-manual-confirmation-artists
 *   npm run db:report-manual-confirmation-artists -- --json
 *   npm run db:report-manual-confirmation-artists -- --names-only
 *   npm run db:report-manual-confirmation-artists -- --extract-only
 *   npm run db:report-manual-confirmation-artists -- --extract-only --names-only
 *   npm run db:report-manual-confirmation-artists -- --include-billing
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
  isBillingLineupDisplayName,
} from './lib/lineup-real-artist-catalog.mjs';
import {
  extractLineupDiscogsSearchNames,
  extractMainLineupArtist,
} from './lib/lineup-discogs-search.mjs';
import { normalizeArtistNameKey } from './lib/festival-lineup-fallback.mjs';

loadDotEnv();

const asJson = process.argv.includes('--json');
const namesOnly = process.argv.includes('--names-only');
const includeBilling = process.argv.includes('--include-billing');
const extractOnly = process.argv.includes('--extract-only');

function enrichArtistRecord(artist) {
  const extractedMainArtist = extractMainLineupArtist(artist.lineupName);
  const discogsSearchNames = extractLineupDiscogsSearchNames(artist.lineupName);
  return {
    ...artist,
    extractedMainArtist,
    discogsSearchNames,
    needsExtract:
      extractedMainArtist !== artist.lineupName.trim() ||
      discogsSearchNames.length > 1 ||
      (discogsSearchNames[0] ?? '') !== artist.lineupName.trim(),
  };
}

function formatArtistLine(artist) {
  const hints = [
    artist.issue,
    artist.discogsId ? `#${artist.discogsId} ${artist.discogsName ?? ''}`.trim() : null,
    artist.topCandidates ? `candidates=${artist.topCandidates}` : null,
    artist.reviewReason ? `reason=${artist.reviewReason}` : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const extract =
    artist.needsExtract && artist.extractedMainArtist
      ? ` → main="${artist.extractedMainArtist}" search=[${artist.discogsSearchNames.join(', ')}]`
      : '';

  return `- ${artist.lineupName}${extract}${hints ? ` | ${hints}` : ''}`;
}

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
  }).map(enrichArtistRecord);

  let billingRows = [];
  if (includeBilling || extractOnly) {
    const soloKeys = new Set(
      realSoloTargets.map((name) => normalizeArtistNameKey(name)),
    );
    billingRows = displayNames
      .filter((name) => {
        const key = normalizeArtistNameKey(name);
        if (soloKeys.has(key)) {
          return false;
        }
        return isBillingLineupDisplayName(name) || extractOnly;
      })
      .map((lineupName) => {
        const mapRow = mapByKey.get(normalizeArtistNameKey(lineupName)) ?? null;
        const dj = mapRow?.discogsId ? djById.get(mapRow.discogsId) ?? null : null;
        return enrichArtistRecord({
          lineupName,
          lineupNameKey: normalizeArtistNameKey(lineupName),
          issue: mapRow?.status === 'mapped' ? 'mapped_billing' : 'billing_row',
          mapStatus: mapRow?.status ?? null,
          source: mapRow?.source ?? null,
          discogsId: mapRow?.discogsId ?? dj?.discogsId ?? null,
          discogsName: mapRow?.discogsName ?? dj?.name ?? null,
          topCandidates: null,
          reviewReason: mapRow?.reviewReason?.trim() || null,
        });
      })
      .filter((row) => row.needsExtract);
  }

  await mongoose.disconnect();

  const report = {
    generatedAt: new Date().toISOString(),
    lineupDisplayCount: displayNames.length,
    realSoloTargetCount: realSoloTargets.length,
    missingRealProfileCount: artists.length,
    billingExtractCount: billingRows.length,
    artists,
    billingExtracts: billingRows,
  };

  if (extractOnly) {
    const rows = [...artists, ...billingRows].filter((row) => row.needsExtract);
    if (namesOnly) {
      for (const artist of rows) {
        console.log(
          `${artist.lineupName}\t${artist.extractedMainArtist}\t${artist.discogsSearchNames.join(' | ')}`,
        );
      }
      return;
    }
    if (asJson) {
      console.log(JSON.stringify({ generatedAt: report.generatedAt, rows }, null, 2));
      return;
    }
    console.log(`\n需主艺人提取的条目: ${rows.length}\n`);
    for (const artist of rows) {
      console.log(formatArtistLine(artist));
    }
    return;
  }

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
  console.log(`缺少 mapped 真实资料: ${report.missingRealProfileCount}`);
  if (includeBilling) {
    console.log(`企划/组合名主艺人提取: ${report.billingExtractCount}`);
  }
  console.log('');

  for (const artist of artists) {
    console.log(formatArtistLine(artist));
  }

  if (includeBilling && billingRows.length) {
    console.log('\n--- 企划/组合名（主艺人提取）---');
    for (const artist of billingRows) {
      console.log(formatArtistLine(artist));
    }
  }
}

main().catch((error) => {
  console.error('❌ report-manual-confirmation-artists failed:', error.message ?? error);
  process.exit(1);
});
