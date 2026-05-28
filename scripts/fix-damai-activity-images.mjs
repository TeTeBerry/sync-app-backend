#!/usr/bin/env node
/**
 * Backfill / fix activity.image from Damai verticalPic URLs.
 *
 * Usage:
 *   node scripts/fix-damai-activity-images.mjs
 *   node scripts/fix-damai-activity-images.mjs path/to/damai-response.json
 *
 * With no args, uses built-in verticalPic URLs for GUAN + 风暴深圳.
 * Re-import also applies images: npm run db:import-damai
 *
 * Env: MONGODB_URI / MONGO_URI (default mongodb://127.0.0.1:27017/sync-ai)
 */

import fs from 'fs';
import { createRequire } from 'module';
import mongoose from 'mongoose';

const require = createRequire(import.meta.url);
const { parseDamaiSearchPayload } = require('./lib/damai-import.util.js');

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const keyword = process.env.DAMAI_KEYWORD ?? '电音节';

/** Built-in verticalPic (raw Damai values; normalized on write). */
const DEFAULT_PAYLOAD = {
  keyword,
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
    ],
  },
};

async function readPayloadFromArgs() {
  const arg = process.argv[2];
  if (!arg) return DEFAULT_PAYLOAD;
  const text = fs.readFileSync(arg, 'utf8');
  return JSON.parse(text);
}

async function main() {
  const payload = await readPayloadFromArgs();
  const { items } = parseDamaiSearchPayload(payload, { keyword });

  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    useCreateIndex: true,
    useFindAndModify: false,
  });

  const activities = mongoose.connection.db.collection('activities');
  const updates = [];

  for (const item of items) {
    const image = item.image;
    if (!image) continue;

    const filter = item.damaiProjectId
      ? { $or: [{ code: item.code }, { damaiProjectId: item.damaiProjectId }] }
      : { code: item.code };

    const existing = await activities.findOne(filter);
    if (!existing) {
      updates.push({
        code: item.code,
        name: item.name,
        status: 'skipped',
        reason: 'activity not found',
      });
      continue;
    }

    const before = existing.image ?? '(none)';
    if (before === image) {
      updates.push({
        code: existing.code,
        name: existing.name,
        status: 'unchanged',
        before,
        after: image,
      });
      continue;
    }

    await activities.updateOne({ _id: existing._id }, { $set: { image } });
    updates.push({
      code: existing.code,
      name: existing.name,
      status: 'updated',
      before,
      after: image,
    });
  }

  console.log('Damai activity image fix');
  for (const row of updates) {
    console.log(`\n[${row.code}] ${row.name} — ${row.status}`);
    if (row.before != null) console.log(`  before: ${row.before}`);
    if (row.after != null) console.log(`  after:  ${row.after}`);
    if (row.reason) console.log(`  reason: ${row.reason}`);
  }

  const changed = updates.filter((r) => r.status === 'updated');
  console.log(
    `\nDone: ${changed.length} updated, ${updates.length - changed.length} unchanged/skipped`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Fix failed:', error.message ?? error);
  process.exit(1);
});
