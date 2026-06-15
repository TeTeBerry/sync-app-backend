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
  },
  {
    legacyId: 8,
    code: 'edc-korea',
    name: 'EDC Korea 2026',
    alias: [
      'edc korea',
      'edc korea 2026',
      'edc韩国',
      '韩国edc',
      'korea edc',
      'edckorea',
      '仁川edc',
    ],
    date: '10/03-04',
    location: '仁川 Inspire Entertainment Resort',
    latitude: 37.466757,
    longitude: 126.390594,
    region: 'overseas',
    image:
      'https://d3vhc53cl8e8km.cloudfront.net/hello-staging/wp-content/uploads/sites/73/2026/02/09161528/edck_2026_mk_an_fest_site_seo_1200x630_r01.png',
    activityType: 'festival',
    hot: true,
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

  const registrations = mongoose.connection.db.collection('activityregistrations');
  const grouped = await registrations
    .aggregate([
      { $match: { status: 'registered' } },
      { $group: { _id: '$activityLegacyId', count: { $sum: 1 } } },
    ])
    .toArray();
  const countByLegacyId = new Map(grouped.map((row) => [row._id, row.count]));
  const catalog = await activities.find({}).project({ legacyId: 1 }).toArray();
  await Promise.all(
    catalog.map((activity) =>
      activities.updateOne(
        { _id: activity._id },
        { $set: { attendees: countByLegacyId.get(activity.legacyId) ?? 0 } },
      ),
    ),
  );

  console.log('✅ Activity catalog synced');
  console.log(`   upserted: ${ACTIVITY_SEED.length} festivals`);
  console.log(`   removed deprecated: ${removed.deletedCount}`);

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Sync failed:', error.message ?? error);
  process.exit(1);
});
