/**
 * Migration script: Create TripPlan documents for users with existing
 * guide / itinerary / ledger data.
 *
 * Usage: node scripts/migrate-trip-plans.mjs [--dry-run]
 */
const { MongoClient } = require('mongodb');

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017/sync';
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  console.log('🔍 Scanning for migration candidates...');

  // Find users with guide data
  const guideUsers = await db.collection('travel_guide_generation_jobs')
    .aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: { ownerUserId: '$ownerUserId', activityLegacyId: '$activityLegacyId' }, guideJobIds: { $push: '$_id' } } },
    ]).toArray();

  // Find users with itinerary data
  const itineraryUsers = await db.collection('user_itineraries')
    .aggregate([
      { $group: { _id: { userId: '$userId', activityLegacyId: '$activityLegacyId' }, itineraryIds: { $push: '$_id' } } },
    ]).toArray();

  // Find users with travel plan data
  const planUsers = await db.collection('user_travel_plans')
    .aggregate([
      { $group: { _id: { userId: '$userId', activityLegacyId: '$activityLegacyId' }, planIds: { $push: '$_id' } } },
    ]).toArray();

  // Merge all into a unified set
  const allPairs = new Map();
  for (const item of guideUsers) {
    const key = `${item._id.ownerUserId}|${item._id.activityLegacyId}`;
    if (!allPairs.has(key)) allPairs.set(key, {});
    allPairs.get(key).guideJobId = item.guideJobIds[0]?.toString();
  }
  for (const item of itineraryUsers) {
    const key = `${item._id.userId}|${item._id.activityLegacyId}`;
    if (!allPairs.has(key)) allPairs.set(key, {});
    allPairs.get(key).itineraryId = item.itineraryIds[0]?.toString();
  }
  for (const item of planUsers) {
    const key = `${item._id.userId}|${item._id.activityLegacyId}`;
    if (!allPairs.has(key)) allPairs.set(key, {});
    allPairs.get(key).travelPlanId = item.planIds[0]?.toString();
  }

  console.log(`📊 Found ${allPairs.size} user-activity pairs to migrate`);

  let created = 0;
  let skipped = 0;

  for (const [key, data] of allPairs) {
    const [ownerId, activityLegacyIdStr] = key.split('|');
    const activityLegacyId = Number(activityLegacyIdStr);

    // Check if TripPlan already exists
    const existing = await db.collection('trip_plans').findOne({
      ownerId,
      activityLegacyId,
    });

    if (existing) {
      skipped++;
      // Update existing with missing data
      const update = {};
      if (data.guideJobId && !existing.guideId) update.guideId = data.guideJobId;
      if (data.itineraryId && !existing.itineraryId) update.itineraryId = data.itineraryId;
      if (data.travelPlanId && !existing.travelPlanId) update.travelPlanId = data.travelPlanId;
      if (Object.keys(update).length > 0) {
        if (!DRY_RUN) {
          await db.collection('trip_plans').updateOne({ _id: existing._id }, { $set: update });
        }
      }
      continue;
    }

    created++;
    if (!DRY_RUN) {
      await db.collection('trip_plans').insertOne({
        activityLegacyId,
        ownerId,
        memberIds: [ownerId],
        guideId: data.guideJobId,
        itineraryId: data.itineraryId,
        travelPlanId: data.travelPlanId,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
  }

  console.log(`✅ Created: ${created}, Updated: ${skipped}`);
  if (DRY_RUN) console.log('⚠️  Dry run — no changes applied. Remove --dry-run to apply.');

  await client.close();
}

main().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
