/**
 * Patch hero (images[0]) for Luna / Sean STORM demo posts in MongoDB.
 *
 * Usage:
 *   node scripts/patch-storm-post-hero-images.mjs
 *   npm run db:patch-storm-heroes
 *
 * Env: MONGODB_URI or MONGO_URI (default mongodb://127.0.0.1:27017/sync-ai)
 */
import mongoose from 'mongoose';

const uri =
  process.env.MONGODB_URI ?? process.env.MONGO_URI ?? 'mongodb://127.0.0.1:27017/sync-ai';

const STORM_ACTIVITY_LEGACY_ID = 4;

/** WeChat-safe picsum heroes (passed through by sanitizeRemoteImageUrl). */
const HERO_BY_USER_ID = {
  'demo-luna': 'https://picsum.photos/seed/sync-storm-luna-hero/800/600',
  'demo-sean': 'https://picsum.photos/seed/sync-storm-sean-hero/800/600',
};

async function main() {
  await mongoose.connect(uri);

  const posts = mongoose.connection.db.collection('posts');
  let updated = 0;

  try {
    for (const [userId, heroUrl] of Object.entries(HERO_BY_USER_ID)) {
      const cursor = posts.find({
        activityLegacyId: STORM_ACTIVITY_LEGACY_ID,
        userId,
        images: { $exists: true, $not: { $size: 0 } },
      });

      for await (const post of cursor) {
        const images = [...(post.images ?? [])];
        if (images[0] === heroUrl) continue;
        images[0] = heroUrl;
        await posts.updateOne({ _id: post._id }, { $set: { images } });
        updated++;
        console.log(`Updated ${userId} post ${post._id}: images[0] -> ${heroUrl}`);
      }
    }

    console.log(`\nDone. ${updated} post(s) updated.`);
  } catch (error) {
    console.error('Patch failed:', error.message);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
  }
}

main();
