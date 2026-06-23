#!/usr/bin/env node
/**
 * Upsert production ops seed buddy posts into MongoDB (US-Q2-21).
 *
 * Usage:
 *   MONGODB_URI='<connection>' npm run db:seed-ops-buddy-posts
 *   MONGODB_URI='<connection>' npm run db:seed-ops-buddy-posts -- --dry-run
 */

import mongoose from 'mongoose';
import {
  buildOpsSeedBuddyPosts,
  OPS_SEED_ACTIVITY_LEGACY_IDS,
  OPS_SEED_POST_USER_PREFIX,
} from '../src/modules/partner/data/ops-seed-buddy-posts.util';

const dryRun = process.argv.includes('--dry-run');

function resolveMongoUri(): string {
  const uri = process.env.MONGODB_URI ?? process.env.MONGO_URI;
  if (!uri) {
    throw new Error(
      'MONGODB_URI (or MONGO_URI) is required — refusing to default to localhost for ops seed.',
    );
  }
  return uri;
}

function summarizeMongoHost(uri: string): string {
  try {
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, 'https://'));
    return parsed.hostname || uri;
  } catch {
    return uri.replace(/\/\/[^@]+@/, '//***@').slice(0, 80);
  }
}

async function main() {
  const uri = resolveMongoUri();
  const host = summarizeMongoHost(uri);

  console.log(`Target MongoDB host: ${host}`);
  console.log(
    `Activities: ${OPS_SEED_ACTIVITY_LEGACY_IDS.join(', ')} (legacyId)`,
  );
  console.log(`Mode: ${dryRun ? 'DRY RUN (no writes)' : 'UPSERT'}`);

  const seeds = buildOpsSeedBuddyPosts();

  if (dryRun) {
    for (const seed of seeds) {
      console.log(
        `  [${seed.activityLegacyId}] ${seed.userId} | ${seed.recruitStatus} ${seed.slotsFilled}/${seed.slotsTotal} | ${seed.departureCity}`,
      );
      console.log(
        `    ${seed.body.slice(0, 72)}${seed.body.length > 72 ? '…' : ''}`,
      );
    }
    console.log(`✅ Dry run complete: ${seeds.length} posts would be upserted`);
    return;
  }

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('posts');
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

  console.log(`✅ Ops seed posts upserted: ${upserted}/${seeds.length}`);

  for (const legacyId of OPS_SEED_ACTIVITY_LEGACY_IDS) {
    const total = await collection.countDocuments({
      activityLegacyId: legacyId,
      userId: { $regex: `^${OPS_SEED_POST_USER_PREFIX}` },
    });
    console.log(`  activityLegacyId=${legacyId}: ${total} ops-seed posts`);
  }

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(
    '❌ Ops seed post seed failed:',
    (error as Error).message ?? error,
  );
  process.exit(1);
});
