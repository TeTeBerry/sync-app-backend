#!/usr/bin/env node
/**
 * Upsert 2026 festival catalog and remove retired mock festivals from MongoDB.
 *
 * Usage:
 *   node scripts/sync-activity-catalog.mjs
 *   MONGODB_URI=mongodb://127.0.0.1:27017/sync-ai node scripts/sync-activity-catalog.mjs
 */

import mongoose from 'mongoose';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

/** Keep in sync with src/modules/activity/activity.seed.ts */
const ACTIVITY_SEED = [
  {
    legacyId: 1,
    code: 'tomorrowland',
    name: 'Tomorrowland Thailand 2026',
    alias: ['tomorrowland', 'tomorrowland thailand', 'tml泰国', '明日世界', 'tmw'],
    date: '12/11-13',
    location: '芭提雅 Wisdom Valley',
    latitude: 12.9367,
    longitude: 100.8839,
    region: 'overseas',
    image:
      'https://mma.prnewswire.com/media/2921955/Tomorrowland_Thailand_PR_Newswire.jpg',
    hot: true,
    attendees: 1500,
  },
  {
    legacyId: 4,
    code: 'storm',
    name: '风暴电音节 深圳站',
    alias: ['storm', '风暴', '风暴电音节', '百威风暴', '口味王风暴'],
    date: '06/13-14',
    location: '深圳国际会展中心',
    latitude: 22.704518,
    longitude: 113.771513,
    region: 'domestic',
    image:
      'https://img.alicdn.com/imgextra/i2/2251059038/O1CN011VWlmX2GdSmiFVt13_!!2251059038.jpg',
    hot: true,
    attendees: 420,
  },
  {
    legacyId: 5,
    code: 'edc-thailand',
    name: 'EDC Thailand 2026',
    alias: ['edc thailand', 'edc泰国', '泰国edc', 'edc 泰国'],
    date: '12/18-20',
    location: '普吉岛 Rhythm Park',
    latitude: 7.96,
    longitude: 98.35,
    region: 'overseas',
    image:
      'https://ik.imagekit.io/TBR/Island%20Events/EDC%20Thailand%202026.png?updatedAt=1763068886366',
    hot: true,
    attendees: 180,
  },
];

const DEPRECATED_FILTER = {
  $or: [
    { code: 's2o' },
    { legacyId: 3 },
    { code: 'sync-live-sh' },
    { legacyId: 7 },
    { code: 'ultra' },
    { code: 'edc' },
    { legacyId: 2 },
    { code: 'vac-zhuhai' },
    { legacyId: 6 },
  ],
};

async function main() {
  await mongoose.connect(uri);

  const activities = mongoose.connection.db.collection('activities');

  for (const item of ACTIVITY_SEED) {
    await activities.findOneAndUpdate(
      { code: item.code },
      { $set: item },
      { upsert: true },
    );
  }

  const removed = await activities.deleteMany(DEPRECATED_FILTER);

  console.log('✅ Activity catalog synced');
  console.log(`   upserted: ${ACTIVITY_SEED.length} festivals`);
  console.log(`   removed deprecated: ${removed.deletedCount}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Sync failed:', error.message ?? error);
  process.exit(1);
});
