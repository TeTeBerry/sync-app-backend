#!/usr/bin/env node
/**
 * Land v4 Discogs candidates into dj_discogs_map + djs (from latest v4 run JSON).
 *
 * Targets: artists still missing real profile data (report-manual-confirmation scope).
 * Writes hermesEvidence + displayGenres, crawls Discogs, replaces manual-stub when needed.
 *
 * Usage:
 *   npm run db:apply-v4-pending-landings -- --dry-run
 *   npm run db:apply-v4-pending-landings
 *   npm run db:apply-v4-pending-landings -- --min-confidence high
 *   npm run db:apply-v4-pending-landings -- --names "ZANY,B-FRONT" --dry-run
 *   npm run db:apply-v4-pending-landings -- --v4-run ../hermes-agent/runs/v4-20260627-145342.json
 *   npm run db:apply-v4-pending-landings -- --limit 25
 */

import mongoose from 'mongoose';
import {
  applyV4PendingLandings,
  planV4PendingLandings,
} from './lib/apply-v4-pending-landings.mjs';
import { createDjDiscogsMapModel } from './lib/dj-discogs-map.mjs';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  createDiscogsClient,
  createDjModel,
  getCrawlConfig,
  loadAllCatalogLineupDisplayNames,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';
import { collectArtistsMissingRealProfile } from './lib/lineup-real-artist-catalog.mjs';
import { resolveV4RunPathFromArgv } from './lib/v4-run-bundle-index.mjs';

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const asJson = argv.includes('--json');
const purgeStub = !argv.includes('--no-purge-stub');

function readArg(flag) {
  const index = argv.indexOf(flag);
  if (index === -1) {
    return '';
  }
  return argv[index + 1]?.trim() ?? '';
}

function readNamesArg() {
  const value = readArg('--names');
  if (!value) {
    return null;
  }
  return value
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean);
}

async function main() {
  const config = getCrawlConfig();
  if (!config.discogsToken) {
    throw new Error('Missing DISCOGS_TOKEN');
  }

  const v4RunPath = resolveV4RunPathFromArgv(argv);
  const minConfidence = readArg('--min-confidence') || 'medium';
  const limit = Number(readArg('--limit') || '0');
  const nameFilter = readNamesArg();

  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const mapCol = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);
  const discogs = createDiscogsClient(config);

  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  const maps = await mapCol.find({}).toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));
  const djs = await Dj.find({}).lean();
  const djById = new Map(djs.map((row) => [row.discogsId, row]));

  const missingArtists = collectArtistsMissingRealProfile({
    displayNames,
    mapByKey,
    djById,
  });

  if (dryRun) {
    const plan = planV4PendingLandings({
      missingArtists,
      v4RunPath,
      minConfidence,
    });
    let planned = plan.planned;
    if (nameFilter?.length) {
      const allowed = new Set(
        nameFilter.map((name) => name.trim().toUpperCase()),
      );
      planned = planned.filter((row) =>
        allowed.has(row.lineupName.trim().toUpperCase()),
      );
    }
    if (limit > 0) {
      planned = planned.slice(0, limit);
    }

    const payload = {
      generatedAt: new Date().toISOString(),
      dryRun: true,
      v4RunPath: plan.v4RunPath,
      v4RunId: plan.v4RunId,
      minConfidence,
      missingRealProfileCount: missingArtists.length,
      plannedCount: planned.length,
      planned,
      skippedCount: plan.skipped.length,
      skipped: plan.skipped,
    };

    await mongoose.disconnect();

    if (asJson) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }

    console.log(`\nv4 跑批: ${payload.v4RunPath}`);
    console.log(`缺真实资料: ${payload.missingRealProfileCount}`);
    console.log(`将落地 (min-confidence=${minConfidence}): ${payload.plannedCount}\n`);
    for (const row of planned) {
      console.log(
        `- ${row.lineupName} | #${row.discogsId} ${row.discogsName} | v4=${row.v4Decision}/${row.v4Confidence}${row.issue === 'manual_stub' ? ' | purge-stub' : ''}`,
      );
    }
    console.log('\n执行: npm run db:apply-v4-pending-landings');
    return;
  }

  const results = await applyV4PendingLandings({
    missingArtists,
    mapCollection: mapCol,
    Dj,
    discogs,
    v4RunPath,
    minConfidence,
    dryRun,
    purgeStub,
    limit,
    nameFilter,
    verify: !argv.includes('--no-verify'),
    discogsToken: config.discogsToken,
    mapByKey,
    djById,
  });

  if (!dryRun) {
    await bumpDjCatalogCacheVersion();
  }

  await closeDjDiscogsRedisCache();
  await mongoose.disconnect();

  const payload = {
    generatedAt: new Date().toISOString(),
    dryRun,
    minConfidence,
    purgeStub,
    v4RunPath: results.v4RunPath,
    v4RunId: results.v4RunId,
    appliedCount: results.applied.length,
    stubPurgedCount: results.stubPurged.length,
    failedCount: results.failed.length,
    verifyRejectedCount: results.verifyRejected.length,
    skippedCount: results.skipped.length,
    applied: results.applied,
    stubPurged: results.stubPurged,
    failed: results.failed,
    verifyRejected: results.verifyRejected,
    skipped: results.skipped,
  };

  if (asJson) {
    console.log(JSON.stringify(payload));
    return;
  }

  console.log(`\nv4 跑批: ${payload.v4RunPath}`);
  console.log(
    `${dryRun ? 'DRY-RUN ' : ''}落地: ${payload.appliedCount}，清 stub: ${payload.stubPurgedCount}，` +
      `verify 拒绝: ${payload.verifyRejectedCount}，失败: ${payload.failedCount}`,
  );

  for (const row of results.applied) {
    console.log(
      `- ${row.lineupName} → #${row.discogsId} ${row.discogsName ?? ''} (${row.status})`,
    );
  }

  for (const row of results.failed) {
    console.log(`! ${row.lineupName} #${row.discogsId}: ${row.error}`);
  }
}

main().catch(async (error) => {
  console.error('❌ apply-v4-pending-landings failed:', error.message ?? error);
  try {
    await closeDjDiscogsRedisCache();
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
