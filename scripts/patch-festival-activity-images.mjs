#!/usr/bin/env node
/**
 * Backfill real festival posters for catalog activities not on Damai 电音节 import.
 *
 * Sources (no Damai verticalPic for these codes):
 * - edc: EDC China 2025 official site hero
 * - tomorrowland: TAT / Tomorrowland Thailand PR (PR Newswire, Feb 2026)
 *
 * Usage: node scripts/patch-festival-activity-images.mjs
 * Env: MONGODB_URI / MONGO_URI (default mongodb://127.0.0.1:27017/sync-ai)
 */

import mongoose from 'mongoose';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

/** Keep in sync with activity.seed.ts / sync-activity-catalog.mjs */
const FESTIVAL_IMAGES = [
  {
    code: 'edc-thailand',
    image:
      'https://ik.imagekit.io/TBR/Island%20Events/EDC%20Thailand%202026.png?updatedAt=1763068886366',
    source: 'EDC Thailand 2026 official poster (ImageKit / Island Events)',
  },
  {
    code: 'edc',
    image:
      'https://image.electricdaisycarnival.cn/sites/7/2024/12/edccn_2025_mk_an_fest_site_mh_1534x1360_r01.jpg',
    source: 'EDC China 2025 official site (electricdaisycarnival.cn)',
  },
  {
    code: 'tomorrowland',
    image:
      'https://mma.prnewswire.com/media/2921955/Tomorrowland_Thailand_PR_Newswire.jpg',
    source:
      'TAT Tomorrowland Thailand PR (PR Newswire, announcement Feb 2026)',
  },
];

async function main() {
  await mongoose.connect(uri);

  const activities = mongoose.connection.db.collection('activities');
  const updates = [];

  for (const { code, image, source } of FESTIVAL_IMAGES) {
    const existing = await activities.findOne({ code });
    if (!existing) {
      updates.push({ code, status: 'skipped', reason: 'activity not found' });
      continue;
    }

    const before = existing.image ?? '(none)';
    if (before === image) {
      updates.push({ code, status: 'unchanged', before, after: image, source });
      continue;
    }

    await activities.updateOne({ _id: existing._id }, { $set: { image } });
    updates.push({
      code,
      status: 'updated',
      before,
      after: image,
      source,
    });
  }

  console.log('Festival activity image patch');
  for (const row of updates) {
    console.log(`\n[${row.code}] — ${row.status}`);
    if (row.before != null) console.log(`  before: ${row.before}`);
    if (row.after != null) console.log(`  after:  ${row.after}`);
    if (row.source) console.log(`  source: ${row.source}`);
    if (row.reason) console.log(`  reason: ${row.reason}`);
  }

  const changed = updates.filter((r) => r.status === 'updated');
  console.log(
    `\nDone: ${changed.length} updated, ${updates.length - changed.length} unchanged/skipped`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('Patch failed:', error.message ?? error);
  process.exit(1);
});
