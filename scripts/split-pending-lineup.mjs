#!/usr/bin/env node
/**
 * Split composite / billing lineup rows → combo-billing map rows + solo crawl targets.
 *
 * Uses expandRealSoloArtistTargets: B2B / & / X, quoted set titles,
 * dash/colon subtitles (EZG - MAXIMAAL!, THAROZA - LIVE OR DIE), trailing LIVE/SET.
 *
 * 1. Composite display names (B2B / & / X) → dj_discogs_map source=combo-billing
 * 2. Expanded solo parts missing from map → queued for v3 crawl
 * 3. Remaining pending_review solos → listed for v3 --pending-review-only
 *
 * Usage:
 *   npm run db:split-pending-lineup
 *   npm run db:split-pending-lineup -- --dry-run
 *   npm run db:split-pending-lineup -- --crawl
 */

import { execSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mongoose from 'mongoose';
import {
  createDjDiscogsMapModel,
  lineupNameKeyFor,
  upsertDjDiscogsMapComboBilling,
} from './lib/dj-discogs-map.mjs';
import {
  collectRealSoloArtistTargets,
  expandRealSoloArtistTargets,
  isBillingLineupDisplayName,
  isLineupNonArtistLabel,
} from './lib/lineup-real-artist-catalog.mjs';
import {
  findMissingCatalogArtists,
  getCrawlConfig,
  loadAllCatalogLineupArtistNames,
  loadDotEnv,
  partitionLineupArtistCoverage,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const runCrawl = args.includes('--crawl');

function partIsMapped(part, mapByKey) {
  const row = mapByKey.get(lineupNameKeyFor(part));
  if (!row || row.status !== 'mapped') {
    return false;
  }
  if (row.source === 'combo-billing') {
    return false;
  }
  return Boolean(row.discogsId);
}

async function loadDisplayNames(db) {
  const rows = await db
    .collection('artist_performances')
    .find({ artistName: { $nin: [null, '', '国内艺人'] } })
    .project({ artistName: 1 })
    .toArray();
  return [...new Set(rows.map((row) => row.artistName.trim()).filter(Boolean))];
}

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;

  const displayNames = await loadDisplayNames(db);
  const billings = displayNames.filter((name) =>
    isBillingLineupDisplayName(name),
  );

  const maps = await mapCollection
    .find({})
    .project({
      lineupNameKey: 1,
      status: 1,
      source: 1,
      discogsId: 1,
    })
    .toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));

  let comboWritten = 0;
  let comboSkipped = 0;
  let comboFullCoverage = 0;
  const comboReports = [];

  for (const displayName of billings.sort()) {
    const parts = expandRealSoloArtistTargets(displayName);
    const coveredParts = parts.filter((part) => partIsMapped(part, mapByKey));
    const allCovered = coveredParts.length === parts.length && parts.length > 0;
    const reviewReason = allCovered
      ? ''
      : `combo billing — awaiting parts: ${parts
          .filter((part) => !partIsMapped(part, mapByKey))
          .join(', ')}`;

    comboReports.push({
      displayName,
      parts,
      allCovered,
      uncovered: parts.filter((part) => !partIsMapped(part, mapByKey)),
    });

    if (dryRun) {
      const existing = mapByKey.get(lineupNameKeyFor(displayName));
      if (existing?.discogsId && existing.source !== 'combo-billing') {
        comboSkipped += 1;
      }
      continue;
    }

    const result = await upsertDjDiscogsMapComboBilling(mapCollection, {
      lineupName: displayName,
      parts,
      reviewReason,
    });
    if (result.skipped) {
      comboSkipped += 1;
      continue;
    }
    comboWritten += 1;
    if (allCovered) {
      comboFullCoverage += 1;
    }
  }

  const soloTargets = collectRealSoloArtistTargets(displayNames);
  const missingSolo = soloTargets.filter(
    (name) => !mapByKey.has(lineupNameKeyFor(name)),
  );

  const catalogNames = await loadAllCatalogLineupArtistNames(db, config);
  const { missing: missingCatalog } = await partitionLineupArtistCoverage(
    db,
    catalogNames,
  );

  const pendingRows = await mapCollection
    .find({ status: 'pending_review' })
    .project({ lineupName: 1 })
    .toArray();
  const pendingSolos = pendingRows
    .map((row) => row.lineupName?.trim())
    .filter(
      (name) =>
        name &&
        !isBillingLineupDisplayName(name) &&
        !isLineupNonArtistLabel(name),
    );

  console.log(`\n=== Split pending lineup ${dryRun ? '(dry-run)' : ''} ===`);
  console.log(`📋 阵容 display names: ${displayNames.length}`);
  console.log(`🔗 组合 / billing: ${billings.length}`);
  if (!dryRun) {
    console.log(
      `   写入 combo-billing: ${comboWritten}（保留原 Discogs mapped ${comboSkipped}，全员覆盖 ${comboFullCoverage}）`,
    );
  } else if (comboSkipped) {
    console.log(`   将保留原 Discogs mapped: ${comboSkipped}`);
  }
  console.log(`🎤 展开 solo（无 map 行）: ${missingSolo.length}`);
  console.log(`📦 catalog 未覆盖: ${missingCatalog.length}`);
  console.log(`⏳ pending_review solo: ${pendingSolos.length}`);

  const uncoveredCombos = comboReports.filter((row) => !row.allCovered);
  if (uncoveredCombos.length) {
    console.log(`\n--- 组合待补齐 (${uncoveredCombos.length}) ---`);
    for (const row of uncoveredCombos.slice(0, 25)) {
      console.log(
        `  ${row.displayName} → 缺: ${row.uncovered.join(', ') || '—'}`,
      );
    }
    if (uncoveredCombos.length > 25) {
      console.log(`  … 另有 ${uncoveredCombos.length - 25} 条`);
    }
  }

  if (missingSolo.length) {
    console.log(`\n--- 新增 solo 待 crawl（前 30）---`);
    for (const name of missingSolo.sort().slice(0, 30)) {
      console.log(`  ${name}`);
    }
  }

  await mongoose.disconnect();

  if (dryRun) {
    console.log('\nℹ️  dry-run — 未写库。加 --crawl 可在写入后跑 v3');
    return;
  }

  if (!runCrawl) {
    console.log(
      '\n下一步: npm run db:split-pending-lineup -- --crawl\n' +
        '  或: npm run db:crawl-catalog-artists && npm run db:crawl-catalog-artists:pending',
    );
    return;
  }

  console.log('\n▶ v3 crawl — missing catalog artists');
  execSync('npm run db:crawl-catalog-artists', {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  console.log('\n▶ v3 crawl — pending-review rematch');
  execSync('npm run db:crawl-catalog-artists:pending', {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  });

  console.log('\n✅ split + v3 crawl 完成');
}

main().catch(async (error) => {
  console.error('❌ split-pending-lineup failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
