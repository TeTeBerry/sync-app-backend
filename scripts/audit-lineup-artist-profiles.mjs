#!/usr/bin/env node
/**
 * Audit lineup artist → Discogs catalog matches and profile trust.
 *
 * Usage:
 *   node scripts/audit-lineup-artist-profiles.mjs
 *   MONGODB_URI='mongodb://...' AUDIT_DB_LABEL=cloud node scripts/audit-lineup-artist-profiles.mjs
 */

import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

const {
  loadDotEnv,
  getCrawlConfig,
  loadAllCatalogLineupArtistNames,
} = await import('./lib/discogs-crawl.mjs');
const {
  LINEUP_MANUAL_DJ_PROFILES,
} = await import('./lib/festival-lineup-fallback.mjs');

const {
  DISCOGS_LINEUP_ARTIST_IDS,
  DISCOGS_LINEUP_SEARCH_ALIASES,
  SEED_ONLY_LINEUP_ARTISTS,
  matchLineupArtistToCatalog,
} = require(join(__dirname, '../dist/src/modules/dj/lineup-name-match.util.js'));

const {
  isLineupCatalogProfileTrusted,
} = require(join(__dirname, '../dist/src/modules/dj/lineup-catalog-profile-trust.util.js'));

function toCatalogItem(doc) {
  const profile = doc.profileZh?.trim() || doc.profile?.trim() || '';
  return {
    discogsId: doc.discogsId,
    name: doc.name,
    realName: doc.realName,
    profile,
    genres: doc.genres ?? [],
    styles: doc.styles ?? [],
    country: doc.country,
    representativeWorks: doc.representativeWorks ?? [],
  };
}

function auditLineupArtist(lineupName, catalog) {
  const key = lineupName.trim().toUpperCase();
  if (SEED_ONLY_LINEUP_ARTISTS.has(key)) {
    return { lineupName, status: 'seed_only' };
  }
  if (LINEUP_MANUAL_DJ_PROFILES[key]) {
    return { lineupName, status: 'manual' };
  }

  const match = matchLineupArtistToCatalog(lineupName, catalog);
  if (!match) {
    const forcedId = DISCOGS_LINEUP_ARTIST_IDS[key];
    return {
      lineupName,
      status: 'missing',
      reason: forcedId
        ? `forced Discogs #${forcedId} not in catalog`
        : 'no exact catalog match',
    };
  }

  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[key];
  const profile = match.profile?.trim() ?? '';
  if (!profile) {
    return {
      lineupName,
      status: 'empty_profile',
      catalogName: match.name,
      discogsId: match.discogsId,
    };
  }

  const trusted = isLineupCatalogProfileTrusted(lineupName, match, {
    allowedCatalogNames: [match.name, ...(alias ? [alias] : [])],
  });
  if (!trusted) {
    return {
      lineupName,
      status: 'untrusted',
      catalogName: match.name,
      discogsId: match.discogsId,
      reason: 'profile subject mismatch or lineup used as alias',
      profilePreview: profile.slice(0, 120),
    };
  }

  return {
    lineupName,
    status: 'trusted',
    catalogName: match.name,
    discogsId: match.discogsId,
    profilePreview: profile.slice(0, 80),
  };
}

async function main() {
  loadDotEnv();
  const config = getCrawlConfig();
  const uri = process.env.MONGODB_URI ?? config.mongoUri;
  const label = process.env.AUDIT_DB_LABEL ?? 'local';

  await mongoose.connect(uri);
  const db = mongoose.connection.db;
  const docs = await db.collection('djs').find({}).toArray();
  const catalog = docs.map((doc) => toCatalogItem(doc));
  const lineupNames = await loadAllCatalogLineupArtistNames(db, config);

  const rows = lineupNames.map((name) => auditLineupArtist(name, catalog));
  const byStatus = (status) => rows.filter((row) => row.status === status);

  console.log(`\n=== Lineup artist profile audit (${label}) ===`);
  console.log(`MongoDB: ${uri.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`Lineup artists: ${lineupNames.length}`);
  console.log(`DJ catalog rows: ${catalog.length}`);
  console.log('');
  console.log(`✅ trusted:       ${byStatus('trusted').length}`);
  console.log(`↷ seed_only:     ${byStatus('seed_only').length}`);
  console.log(`↷ manual:        ${byStatus('manual').length}`);
  console.log(`⚠️ missing:       ${byStatus('missing').length}`);
  console.log(`⚠️ empty_profile: ${byStatus('empty_profile').length}`);
  console.log(`❌ untrusted:     ${byStatus('untrusted').length}`);

  const problems = rows.filter((row) =>
    ['missing', 'empty_profile', 'untrusted'].includes(row.status),
  );
  if (problems.length) {
    console.log('\n--- Issues ---');
    for (const row of problems.sort((a, b) =>
      a.lineupName.localeCompare(b.lineupName),
    )) {
      const meta = [
        row.catalogName ? `catalog=${row.catalogName}` : null,
        row.discogsId ? `#${row.discogsId}` : null,
        row.reason,
      ]
        .filter(Boolean)
        .join(' | ');
      console.log(`• ${row.lineupName} [${row.status}] ${meta}`);
      if (row.profilePreview) {
        console.log(`  ${row.profilePreview}`);
      }
    }
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
