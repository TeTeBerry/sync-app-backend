/**
 * Migration: attach tripPlanId to owner sub-resources and backfill TripPlan refs.
 *
 * Usage:
 *   node scripts/migrate-trip-plan-ownership.cjs [--dry-run]
 */
const { MongoClient, ObjectId } = require('mongodb');

const MONGO_URI =
  process.env.MONGODB_URI ||
  process.env.MONGO_URI ||
  'mongodb://localhost:27017/sync';
const DRY_RUN = process.argv.includes('--dry-run');

async function attachTravelPlan(db, tripPlan, stats) {
  const tripPlanId = String(tripPlan._id);
  const ownerId = tripPlan.ownerId;
  const activityLegacyId = tripPlan.activityLegacyId;

  let travelDoc = null;
  if (tripPlan.travelPlanId) {
    travelDoc = await db.collection('user_travel_plans').findOne({
      _id: new ObjectId(tripPlan.travelPlanId),
    });
  }
  if (!travelDoc) {
    travelDoc = await db.collection('user_travel_plans').findOne({
      tripPlanId,
    });
  }
  if (!travelDoc) {
    travelDoc = await db.collection('user_travel_plans').findOne({
      userId: ownerId,
      activityLegacyId,
      $or: [{ tripPlanId: { $exists: false } }, { tripPlanId: null }],
    });
  }

  if (!travelDoc) return;

  const travelPlanId = String(travelDoc._id);
  const travelUpdate = { tripPlanId, userId: ownerId };
  const tripUpdate = {};

  if (travelDoc.tripPlanId !== tripPlanId) {
    if (!DRY_RUN) {
      await db
        .collection('user_travel_plans')
        .updateOne({ _id: travelDoc._id }, { $set: travelUpdate });
    }
    stats.travelPlansTagged++;
  }

  if (tripPlan.travelPlanId !== travelPlanId) {
    tripUpdate.travelPlanId = travelPlanId;
    stats.tripPlansTravelLinked++;
  }

  if (Object.keys(tripUpdate).length > 0 && !DRY_RUN) {
    await db
      .collection('trip_plans')
      .updateOne({ _id: tripPlan._id }, { $set: tripUpdate });
  }
}

async function attachItinerary(db, tripPlan, stats) {
  const tripPlanId = String(tripPlan._id);
  const ownerId = tripPlan.ownerId;
  const activityLegacyId = tripPlan.activityLegacyId;

  let itineraryDoc = null;
  if (tripPlan.itineraryId) {
    itineraryDoc = await db.collection('user_itineraries').findOne({
      _id: new ObjectId(tripPlan.itineraryId),
    });
  }
  if (!itineraryDoc) {
    itineraryDoc = await db.collection('user_itineraries').findOne({
      tripPlanId,
    });
  }
  if (!itineraryDoc) {
    itineraryDoc = await db.collection('user_itineraries').findOne({
      userId: ownerId,
      activityLegacyId,
      $or: [{ tripPlanId: { $exists: false } }, { tripPlanId: null }],
    });
  }

  if (!itineraryDoc) return;

  const itineraryId = String(itineraryDoc._id);
  const tripUpdate = {};

  if (itineraryDoc.tripPlanId !== tripPlanId) {
    if (!DRY_RUN) {
      await db.collection('user_itineraries').updateOne(
        { _id: itineraryDoc._id },
        { $set: { tripPlanId, userId: ownerId } },
      );
    }
    stats.itinerariesTagged++;
  }

  if (tripPlan.itineraryId !== itineraryId) {
    tripUpdate.itineraryId = itineraryId;
    stats.tripPlansItineraryLinked++;
  }

  if (Object.keys(tripUpdate).length > 0 && !DRY_RUN) {
    await db
      .collection('trip_plans')
      .updateOne({ _id: tripPlan._id }, { $set: tripUpdate });
  }
}

async function attachGuide(db, tripPlan, stats) {
  const tripPlanId = String(tripPlan._id);
  const ownerId = tripPlan.ownerId;
  const activityLegacyId = tripPlan.activityLegacyId;

  let guideId = tripPlan.guideId;
  if (!guideId) {
    const job = await db.collection('travel_guide_generation_jobs').findOne(
      { ownerUserId: ownerId, activityLegacyId, status: 'completed' },
      { sort: { updatedAt: -1 } },
    );
    guideId = job?.jobId;
  }

  if (!guideId) return;

  const tripUpdate = {};
  if (tripPlan.guideId !== guideId) {
    tripUpdate.guideId = guideId;
    stats.tripPlansGuideLinked++;
  }

  if (!DRY_RUN) {
    await db.collection('travel_guide_generation_jobs').updateMany(
      { jobId: guideId },
      { $set: { tripPlanId } },
    );
    await db.collection('travel_guide_saved_plans').updateMany(
      { guideId },
      { $set: { tripPlanId } },
    );
    if (Object.keys(tripUpdate).length > 0) {
      await db
        .collection('trip_plans')
        .updateOne({ _id: tripPlan._id }, { $set: tripUpdate });
    }
  }
}

async function main() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const db = client.db();

  const stats = {
    tripPlansScanned: 0,
    travelPlansTagged: 0,
    itinerariesTagged: 0,
    tripPlansTravelLinked: 0,
    tripPlansItineraryLinked: 0,
    tripPlansGuideLinked: 0,
  };

  const tripPlans = await db.collection('trip_plans').find({}).toArray();
  console.log(`Found ${tripPlans.length} trip plans`);

  for (const tripPlan of tripPlans) {
    stats.tripPlansScanned++;
    await attachTravelPlan(db, tripPlan, stats);
    await attachItinerary(db, tripPlan, stats);
    await attachGuide(db, tripPlan, stats);
  }

  console.log('Migration summary:', stats);
  if (DRY_RUN) {
    console.log('Dry run — no changes applied. Remove --dry-run to apply.');
  }

  await client.close();
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
