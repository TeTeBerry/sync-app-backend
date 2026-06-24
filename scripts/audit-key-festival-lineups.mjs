#!/usr/bin/env node
/** Audit key festival lineups (storm / EDC / TML TH) only */

import mongoose from 'mongoose';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  STORM_LINEUP_ARTIST_NAMES,
  loadEdcThailandFallbackNames,
  loadEdcKoreaFallbackNames,
  loadTomorrowlandThailandFallbackNames,
  expandFestivalArtistNames,
} from './lib/festival-lineup-fallback.mjs';

const require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));
const {
  loadDotEnv,
  getCrawlConfig,
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
  return {
    discogsId: doc.discogsId,
    name: doc.name,
    realName: doc.realName,
    profile: doc.profileZh?.trim() || doc.profile?.trim() || '',
    genres: doc.genres ?? [],
    styles: doc.styles ?? [],
    country: doc.country,
    representativeWorks: doc.representativeWorks ?? [],
  };
}

function audit(lineupName, catalog) {
  const key = lineupName.trim().toUpperCase();
  if (SEED_ONLY_LINEUP_ARTISTS.has(key)) return { lineupName, status: 'seed_only' };
  if (LINEUP_MANUAL_DJ_PROFILES[key]) return { lineupName, status: 'manual' };
  const match = matchLineupArtistToCatalog(lineupName, catalog);
  if (!match) {
    return {
      lineupName,
      status: 'missing',
      reason: DISCOGS_LINEUP_ARTIST_IDS[key]
        ? `forced #${DISCOGS_LINEUP_ARTIST_IDS[key]} missing`
        : 'no match',
    };
  }
  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[key];
  if (!match.profile?.trim()) {
    return { lineupName, status: 'empty_profile', catalogName: match.name, discogsId: match.discogsId };
  }
  const trusted = isLineupCatalogProfileTrusted(lineupName, match, {
    allowedCatalogNames: [match.name, ...(alias ? [alias] : [])],
  });
  return {
    lineupName,
    status: trusted ? 'trusted' : 'untrusted',
    catalogName: match.name,
    discogsId: match.discogsId,
    profilePreview: match.profile.slice(0, 100),
  };
}

loadDotEnv();
const config = getCrawlConfig();
const uri = process.env.MONGODB_URI ?? config.mongoUri;
await mongoose.connect(uri);
const catalog = (await mongoose.connection.db.collection('djs').find({}).toArray()).map(toCatalogItem);
const names = expandFestivalArtistNames([
  ...STORM_LINEUP_ARTIST_NAMES,
  ...loadEdcThailandFallbackNames(),
  ...loadEdcKoreaFallbackNames(),
  ...loadTomorrowlandThailandFallbackNames(),
]);
const unique = [...new Set(names)];
const rows = unique.map((name) => audit(name, catalog));
for (const status of ['trusted', 'seed_only', 'manual', 'missing', 'empty_profile', 'untrusted']) {
  const group = rows.filter((r) => r.status === status);
  console.log(`${status}: ${group.length}`);
  for (const row of group.sort((a, b) => a.lineupName.localeCompare(b.lineupName))) {
    console.log(`  • ${row.lineupName}${row.catalogName ? ` → ${row.catalogName} #${row.discogsId}` : ''}${row.profilePreview ? `\n    ${row.profilePreview}` : ''}`);
  }
}
await mongoose.disconnect();
