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
    image:
      'https://images.unsplash.com/photo-1533174072545-7a4b6ad7a6c3?w=600&q=80',
    hot: true,
    attendees: 1500,
  },
  {
    legacyId: 2,
    code: 'edc',
    name: 'EDC China 2025',
    alias: ['edc电音', 'edc音乐节', 'edc', 'edc china', 'edc中国'],
    date: '03/22-23',
    location: '苏州阳澄湖半岛旅游度假区',
    image:
      'https://image.electricdaisycarnival.cn/sites/7/2024/12/edccn_2025_mk_an_fest_site_mh_1534x1360_r01.jpg',
    hot: false,
    attendees: 512,
  },
  {
    legacyId: 4,
    code: 'storm',
    name: '风暴电音节 深圳站',
    alias: ['storm', '风暴', '风暴电音节', '百威风暴', '口味王风暴'],
    date: '06/13-14',
    location: '深圳国际会展中心',
    image:
      'https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=600&q=80',
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
    image:
      'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=600&q=80',
    hot: true,
    attendees: 180,
  },
  {
    legacyId: 6,
    code: 'vac-zhuhai',
    name: '2026横琴VAC电音节',
    alias: [
      'vac',
      'vac珠海',
      '珠海vac',
      'vision & colour',
      'vision and colour',
      'vision colour',
      '横琴vac',
      '珠海电音节',
    ],
    date: '04/18-19',
    location: '横琴长隆度假区',
    image:
      'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80',
    hot: false,
    attendees: 96,
  },
];

const DEPRECATED_FILTER = {
  $or: [
    { code: 's2o' },
    { legacyId: 3 },
    { code: 'sync-live-sh' },
    { legacyId: 7 },
    { code: 'ultra' },
  ],
};

async function main() {
  await mongoose.connect(uri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

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
