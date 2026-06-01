#!/usr/bin/env node
/**
 * Set GUAN电音节 participant count for homepage cards.
 *
 * Usage: node scripts/patch-guan-attendees.mjs
 * Env: MONGODB_URI / MONGO_URI (default mongodb://127.0.0.1:27017/sync-ai)
 */

import mongoose from 'mongoose';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const GUAN_FILTER = {
  $or: [
    { code: 'damai-1045457803269' },
    { damaiProjectId: '1045457803269' },
    { legacyId: 1045457803269 },
  ],
};

async function main() {
  await mongoose.connect(uri);

  const activities = mongoose.connection.db.collection('activities');
  const result = await activities.updateOne(GUAN_FILTER, {
    $set: { attendees: 128 },
  });

  if (result.matchedCount === 0) {
    console.error('❌ GUAN电音节 activity not found in activities collection');
    process.exit(1);
  }

  const doc = await activities.findOne(GUAN_FILTER, {
    projection: { name: 1, code: 1, legacyId: 1, attendees: 1 },
  });
  console.log('✅ GUAN attendees patched');
  console.log(
    `   ${doc.name} [${doc.code}] legacyId=${doc.legacyId} attendees=${doc.attendees}`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error('❌ Patch failed:', error.message ?? error);
  process.exit(1);
});
