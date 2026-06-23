#!/usr/bin/env node
/**
 * Assign cloud storage avatars to users with empty avatar fields.
 *
 * Usage:
 *   npm run db:backfill-user-avatars:dry-run
 *   MONGODB_URI='mongodb://...' CONFIRM=1 npm run db:backfill-user-avatars
 */

import mongoose from 'mongoose';
import { generatePersonalityRaverAvatarKey } from '../src/modules/personality-test/utils/personality-raver-avatar.util';

const uri =
  process.env.MONGODB_URI ??
  process.env.MONGO_URI ??
  'mongodb://127.0.0.1:27017/sync-ai';

const dryRun = process.argv.includes('--dry-run');
const confirmed = process.env.CONFIRM === '1' || process.env.CONFIRM === 'true';

const EMPTY_AVATAR_FILTER = {
  $or: [
    { avatar: { $exists: false } },
    { avatar: null },
    { avatar: '' },
    { avatar: { $regex: /^\s*$/ } },
  ],
};

function maskMongoUri(value: string): string {
  return value.replace(/\/\/([^@/]+):([^@/]+)@/, '//***:***@');
}

async function main() {
  console.log(`MongoDB: ${maskMongoUri(uri)}`);
  console.log(
    dryRun
      ? 'Mode: dry-run'
      : confirmed
        ? 'Mode: backfill'
        : 'Mode: preview (set CONFIRM=1 to write)',
  );
  console.log('');

  await mongoose.connect(uri);
  const collection = mongoose.connection.db.collection('users');

  const candidates = await collection
    .find(EMPTY_AVATAR_FILTER, {
      projection: { externalId: 1, openid: 1, name: 1, avatar: 1 },
    })
    .toArray();

  if (!candidates.length) {
    console.log('No users with empty avatars found.');
    await mongoose.disconnect();
    return;
  }

  console.log(`Found ${candidates.length} user(s) with empty avatar:`);
  for (const user of candidates) {
    const id = user.externalId ?? user.openid ?? String(user._id);
    const name = typeof user.name === 'string' ? user.name.trim() : '';
    console.log(`  - ${id}${name ? ` (${name})` : ''}`);
  }

  if (dryRun) {
    console.log('');
    console.log('Dry-run only — no data changed.');
    await mongoose.disconnect();
    return;
  }

  if (!confirmed) {
    console.log('');
    console.log('Aborted. Re-run with CONFIRM=1 to assign cloud avatars.');
    await mongoose.disconnect();
    process.exit(1);
  }

  let updated = 0;
  for (const user of candidates) {
    const avatar = generatePersonalityRaverAvatarKey();
    const result = await collection.updateOne(
      { _id: user._id, ...EMPTY_AVATAR_FILTER },
      { $set: { avatar } },
    );
    if ((result.modifiedCount ?? 0) > 0) {
      updated += 1;
      const id = user.externalId ?? user.openid ?? String(user._id);
      console.log(`  ✓ ${id} → ${avatar}`);
    }
  }

  const remaining = await collection.countDocuments(EMPTY_AVATAR_FILTER);
  console.log('');
  console.log(
    `✅ Backfilled ${updated} user avatar(s); ${remaining} still empty.`,
  );

  await mongoose.disconnect();
}

main().catch((error) => {
  console.error(
    '❌ User avatar backfill failed:',
    (error as Error).message ?? error,
  );
  process.exit(1);
});
