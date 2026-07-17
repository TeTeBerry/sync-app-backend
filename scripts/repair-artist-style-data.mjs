#!/usr/bin/env node
/**
 * Evidence-based repair for artist style fields.
 *
 * Safe operations only:
 *  - backfill map.displayStyles from djs.styles for the same discogsId when
 *    displayStyles is empty;
 *  - remove exact, known non-style tokens;
 *  - remove case-insensitive duplicate tokens while preserving first order.
 *
 * No new style is inferred from an artist name or biography.
 *
 * Usage:
 *   NODE_ENV=production node scripts/repair-artist-style-data.mjs --dry-run
 *   NODE_ENV=production node scripts/repair-artist-style-data.mjs --apply
 */

import fs from 'node:fs/promises';
import mongoose from 'mongoose';
import {
  bumpDjCatalogCacheVersion,
  closeDjDiscogsRedisCache,
  getCrawlConfig,
  loadDotEnv,
} from './lib/discogs-crawl.mjs';

loadDotEnv();

const apply = process.argv.includes('--apply');
const auditPath =
  process.env.ARTIST_STYLE_AUDIT_PATH ??
  `/tmp/artist-style-repair-${new Date().toISOString().slice(0, 10)}.json`;

// These are not music styles. They were found as literal values in the live data.
const NON_STYLE_TOKENS = new Set([
  'interview',
  'poetry',
  'spoken word',
  'audiobook',
  'stage & screen',
  'non-music',
]);

function cleanStyles(values) {
  const result = [];
  const seen = new Set();
  const removed = [];

  for (const raw of Array.isArray(values) ? values : []) {
    const value = String(raw ?? '').trim();
    const key = value.toLowerCase();
    if (!value || NON_STYLE_TOKENS.has(key)) {
      if (value) removed.push({ value, reason: 'known_non_style_token' });
      continue;
    }
    if (seen.has(key)) {
      removed.push({ value, reason: 'case_insensitive_duplicate' });
      continue;
    }
    seen.add(key);
    result.push(value);
  }

  return { styles: result, removed };
}

async function main() {
  const config = getCrawlConfig();
  await mongoose.connect(config.mongoUri);
  const db = mongoose.connection.db;
  const mapCollection = db.collection('dj_discogs_map');
  const djCollection = db.collection('djs');

  const [maps, djs] = await Promise.all([
    mapCollection.find({ status: 'mapped' }).toArray(),
    djCollection.find({}).project({ discogsId: 1, styles: 1 }).toArray(),
  ]);
  const djById = new Map(djs.map((row) => [row.discogsId, row]));
  const changes = [];

  for (const row of maps) {
    const dj = row.discogsId ? djById.get(row.discogsId) : null;
    const before = Array.isArray(row.displayStyles) ? row.displayStyles : [];
    const source = before.length ? 'existing_displayStyles' : 'same_discogs_id_djs.styles';
    const candidate = before.length ? before : dj?.styles ?? [];
    const cleaned = cleanStyles(candidate);

    if (!cleaned.styles.length || JSON.stringify(before) === JSON.stringify(cleaned.styles)) {
      continue;
    }

    changes.push({
      lineupName: row.lineupName,
      discogsId: row.discogsId ?? null,
      source,
      before,
      after: cleaned.styles,
      removed: cleaned.removed,
    });

    if (apply) {
      await mapCollection.updateOne(
        { _id: row._id },
        { $set: { displayStyles: cleaned.styles } },
      );
    }
  }

  const audit = {
    generatedAt: new Date().toISOString(),
    mode: apply ? 'apply' : 'dry-run',
    rules: {
      backfillOnlyWhenSameDiscogsIdHasDjsStyles: true,
      nonStyleTokens: [...NON_STYLE_TOKENS],
      dedupe: 'case-insensitive, preserve first occurrence',
    },
    mappedRowsScanned: maps.length,
    djsScanned: djs.length,
    changedRows: changes.length,
    backfilledRows: changes.filter((x) => x.source === 'same_discogs_id_djs.styles').length,
    cleanedExistingRows: changes.filter((x) => x.source === 'existing_displayStyles').length,
    changes,
  };

  await fs.writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  if (apply && changes.length) {
    await bumpDjCatalogCacheVersion();
  }
  await mongoose.disconnect();
  await closeDjDiscogsRedisCache();

  console.log(JSON.stringify({
    mode: audit.mode,
    changedRows: audit.changedRows,
    backfilledRows: audit.backfilledRows,
    cleanedExistingRows: audit.cleanedExistingRows,
    auditPath,
  }, null, 2));
}

main().catch(async (error) => {
  console.error('artist style repair failed:', error.message ?? error);
  try {
    await mongoose.disconnect();
    await closeDjDiscogsRedisCache();
  } catch {
    // ignore cleanup errors
  }
  process.exit(1);
});
