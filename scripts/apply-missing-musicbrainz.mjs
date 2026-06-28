#!/usr/bin/env node
/**
 * MusicBrainz landing for artists still missing real profile (manual / post-crawl).
 *
 * v3 crawl already runs inline MB after Discogs miss; use this for ad-hoc补缺
 * or artists outside the last crawl batch.
 *
 * Usage:
 *   npm run db:apply-missing-musicbrainz:dry-run
 *   npm run db:apply-missing-musicbrainz
 *   npm run db:apply-missing-musicbrainz -- --limit 20
 *   npm run db:apply-missing-musicbrainz -- --names "DJ Sally,Jelle DK"
 *   npm run db:apply-missing-musicbrainz -- --min-match possible
 *   npm run db:apply-missing-musicbrainz -- --no-web-only
 */
import mongoose from 'mongoose';
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
import {
  collectArtistsMissingRealProfile,
  isLineupNonArtistLabel,
} from './lib/lineup-real-artist-catalog.mjs';
import { normalizeMbNameKey } from './lib/musicbrainz-client.mjs';
import {
  crawlMusicBrainzArtistNames,
  createMusicBrainzClient,
} from './lib/musicbrainz-artist-resolve.mjs';

loadDotEnv();

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const allowWebOnly = !argv.includes('--no-web-only');
const verify = !argv.includes('--skip-verify');

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
  const limit = Number(readArg('--limit') || '0');
  const minMatch = readArg('--min-match') || 'strong';
  const nameFilter = readNamesArg();

  if (!['strong', 'possible'].includes(minMatch)) {
    throw new Error('--min-match must be strong or possible');
  }

  const config = getCrawlConfig();
  if (!config.discogsToken && !dryRun) {
    throw new Error('Missing DISCOGS_TOKEN (needed for Discogs landing path)');
  }

  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const displayNames = await loadAllCatalogLineupDisplayNames(db, config);
  const mapCollection = createDjDiscogsMapModel(mongoose).collection;
  const Dj = createDjModel(mongoose);
  const maps = await mapCollection.find({}).toArray();
  const mapByKey = new Map(maps.map((row) => [row.lineupNameKey, row]));
  const djs = await Dj.find({}).lean();
  const djById = new Map(djs.map((row) => [row.discogsId, row]));

  let missing = collectArtistsMissingRealProfile({
    displayNames,
    mapByKey,
    djById,
  }).filter((row) => !isLineupNonArtistLabel(row.lineupName));

  if (nameFilter?.length) {
    const wanted = new Set(nameFilter.map((name) => normalizeMbNameKey(name)));
    missing = missing.filter((row) =>
      wanted.has(normalizeMbNameKey(row.lineupName)),
    );
  }

  if (limit > 0) {
    missing = missing.slice(0, limit);
  }

  const artistNames = missing.map((row) => row.lineupName);
  console.log(
    `\nMusicBrainz 落地 ${dryRun ? '(dry-run)' : ''}: ${artistNames.length} 位缺资料艺人`,
  );
  console.log(`min-match=${minMatch}, web-only=${allowWebOnly}, verify=${verify}\n`);

  if (!artistNames.length) {
    console.log('🎉 无缺资料艺人');
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
    return;
  }

  const summary = await crawlMusicBrainzArtistNames({
    artistNames,
    mapCollection,
    Dj,
    discogs: createDiscogsClient(config),
    discogsToken: config.discogsToken,
    musicBrainz: createMusicBrainzClient(),
    label: '缺资料',
    minMatch,
    allowWebOnly,
    verify,
    dryRun,
  });

  if (!dryRun && summary.applied > 0) {
    await bumpDjCatalogCacheVersion();
  }

  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log('\n── 汇总 ──');
  console.log(`applied (discogs): ${summary.appliedDiscogs}`);
  console.log(`applied (mb web-only): ${summary.appliedMbWeb}`);
  console.log(`skipped: ${summary.skipped}`);
  console.log(`pending: ${summary.pending}`);
  console.log(`error: ${summary.failed}`);
  console.log('\n建议复查: npm run db:report-manual-confirmation-artists');
}

main().catch(async (error) => {
  console.error('❌ apply-missing-musicbrainz failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore
  }
  process.exit(1);
});
