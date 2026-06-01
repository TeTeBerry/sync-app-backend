#!/usr/bin/env node
/**
 * Import Damai search API results into MongoDB activities collection.
 *
 * Usage:
 *   node scripts/import-damai-activities.mjs path/to/response.json
 *   cat response.json | node scripts/import-damai-activities.mjs
 *   node scripts/import-damai-activities.mjs --inline   # uses bundled sample (电音节)
 *
 * Env:
 *   MONGODB_URI / MONGO_URI (default mongodb://127.0.0.1:27017/sync-ai)
 *   DAMAI_KEYWORD (default 电音节) — only names containing this substring are imported
 */

import fs from 'fs';
import { createRequire } from 'module';
import mongoose from 'mongoose';

const require = createRequire(import.meta.url);
const { parseDamaiSearchPayload, damaiDetailUrl } = require(
  './lib/damai-import.util.js',
);

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const keyword = process.env.DAMAI_KEYWORD ?? '电音节';

/** Sample payload (keyword 电音节, 3 API results — 2 match filter). */
const INLINE_SAMPLE = {
  keyword: '电音节',
  pageData: {
    resultData: [
      {
        name: 'GUAN电音节',
        nameNoHtml: 'GUAN电音节',
        projectid: 1045457803269,
        showtime: '2026.05.30-05.31',
        venue: '广东现代国际展览中心(东莞)',
        cityname: '东莞',
        verticalPic:
          'https://img.alicdn.com/bao/uploaded/i3/2251059038/O1CN01DqHXff2GdSmNgmavM_!!4611686018427383646-0-item_pic.jpg',
      },
      {
        name: '2026口味王风暴电音节-深圳站',
        nameNoHtml: '2026口味王风暴电音节-深圳站',
        projectid: 1048730418844,
        showtime: '2026.06.13-06.14',
        venue: '深圳国际会展中心17号馆',
        cityname: '深圳',
        verticalPic:
          'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i2/2251059038/O1CN011VWlmX2GdSmiFVt13_!!2251059038.jpg',
      },
      {
        name: '天上村前·苏荟新年电音汇',
        nameNoHtml: '天上村前·苏荟新年电音汇',
        projectid: 1044918224158,
        showtime: '2026.06.19-06.20',
        venue: '天上村前历史文化街区',
        cityname: '无锡',
        verticalPic:
          'https://img.alicdn.com/bao/uploaded/https://img.alicdn.com/imgextra/i3/2251059038/O1CN01U8gpsk2GdSmjUDRFF_!!2251059038.jpg',
      },
    ],
  },
};

async function readPayloadFromArgs() {
  const arg = process.argv[2];
  if (arg === '--inline') {
    return INLINE_SAMPLE;
  }

  if (arg) {
    const text = fs.readFileSync(arg, 'utf8');
    return JSON.parse(text);
  }

  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  }

  console.error(
    'Usage: node scripts/import-damai-activities.mjs <response.json|--inline>',
  );
  process.exit(1);
}

function toMongoDoc(item) {
  const { _meta, damaiProjectId, externalUrl, ...doc } = item;
  return {
    ...doc,
    damaiProjectId,
    externalUrl,
  };
}

async function main() {
  const payload = await readPayloadFromArgs();
  const { items, skipped } = parseDamaiSearchPayload(payload, { keyword });

  if (items.length === 0) {
    console.log('No matching activities to import.');
    if (skipped.length) {
      console.log('Skipped:');
      for (const row of skipped) {
        console.log(`  - ${row.name}: ${row.reason}`);
      }
    }
    process.exit(0);
  }

  await mongoose.connect(uri);

  const activities = mongoose.connection.db.collection('activities');
  const results = [];

  for (const item of items) {
    const doc = toMongoDoc(item);
    const filter = doc.damaiProjectId
      ? { $or: [{ code: doc.code }, { damaiProjectId: doc.damaiProjectId }] }
      : { code: doc.code };

    const existing = await activities.findOne(filter);
    if (existing?.legacyId && doc.code !== 'storm') {
      doc.legacyId = existing.legacyId;
    }

    const updated = await activities.findOneAndUpdate(
      filter,
      { $set: doc },
      { upsert: true, returnDocument: 'after' },
    );

    results.push({
      code: doc.code,
      legacyId: updated.value?.legacyId ?? doc.legacyId,
      name: doc.name,
      date: doc.date,
      location: doc.location,
      externalUrl: doc.externalUrl ?? damaiDetailUrl(item.damaiProjectId),
      upserted: !existing,
    });
  }

  console.log('✅ Damai activities imported');
  console.log(`   keyword filter: name contains "${keyword}"`);
  console.log(`   upserted/updated: ${results.length}`);
  for (const row of results) {
    console.log(
      `   - [${row.code}] legacyId=${row.legacyId} ${row.name} | ${row.date} | ${row.location}`,
    );
    console.log(`     ${row.externalUrl}`);
  }

  if (skipped.length) {
    console.log(`   skipped: ${skipped.length}`);
    for (const row of skipped) {
      console.log(`     - ${row.name}: ${row.reason}`);
    }
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Import failed:', error.message ?? error);
  process.exit(1);
});
