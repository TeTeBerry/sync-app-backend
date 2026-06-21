#!/usr/bin/env node
/**
 * Upsert Tomorrowland Thailand dev mock buddy posts into MongoDB.
 *
 * Usage:
 *   npm run db:seed-tml-mock-posts
 */

import mongoose from 'mongoose';
import {
  buildDevMockTmlBuddyPosts,
  DEV_MOCK_TML_POST_USER_PREFIX,
  TML_THAILAND_LEGACY_ID,
} from '../src/modules/partner/data/dev-mock-buddy-posts.util';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

async function main() {
  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('posts');
  const seeds = buildDevMockTmlBuddyPosts();
  let upserted = 0;

  for (const seed of seeds) {
    const result = await collection.findOneAndUpdate(
      {
        userId: seed.userId,
        activityLegacyId: seed.activityLegacyId,
      },
      { $set: seed },
      { upsert: true, returnDocument: 'after' },
    );
    if (result) {
      upserted += 1;
    }
  }

  const total = await collection.countDocuments({
    activityLegacyId: TML_THAILAND_LEGACY_ID,
    userId: { $regex: `^${DEV_MOCK_TML_POST_USER_PREFIX}` },
  });

  console.log(
    `✅ TML Thailand mock posts seeded: upserted ${upserted}, total ${total}`,
  );
  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(
    '❌ TML mock post seed failed:',
    (error as Error).message ?? error,
  );
  process.exit(1);
});
