import mongoose from 'mongoose';
import {
  ACTIVITY_SEED,
  DEPRECATED_ACTIVITY_FILTER,
  PUBLIC_RECRUIT_POST_MATCH,
} from './activity-catalog-seed.mjs';

async function syncAttendeeCounts(activities) {
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
}

async function loadRecruitPostCounts() {
  const posts = mongoose.connection.db.collection('posts');
  const rows = await posts
    .aggregate([
      { $match: PUBLIC_RECRUIT_POST_MATCH },
      { $group: { _id: '$activityLegacyId', count: { $sum: 1 } } },
    ])
    .toArray();
  return new Map(rows.map((row) => [row._id, row.count]));
}

/**
 * Upsert festival catalog, remove deprecated rows, sync attendee totals.
 * Returns summary for logging (recruit counts are computed at API cache refresh).
 */
export async function syncActivityCatalog(uri) {
  await mongoose.connect(uri);

  try {
    const activities = mongoose.connection.db.collection('activities');

    for (const item of ACTIVITY_SEED) {
      await activities.findOneAndUpdate(
        { code: item.code },
        { $set: item },
        { upsert: true },
      );
    }

    const removed = await activities.deleteMany(DEPRECATED_ACTIVITY_FILTER);
    await syncAttendeeCounts(activities);
    const recruitPostCounts = await loadRecruitPostCounts();

    const catalog = await activities
      .find({})
      .project({ legacyId: 1, name: 1, attendees: 1 })
      .sort({ legacyId: 1 })
      .toArray();

    return {
      upserted: ACTIVITY_SEED.length,
      removedDeprecated: removed.deletedCount ?? 0,
      activities: catalog.map((activity) => ({
        legacyId: activity.legacyId,
        name: activity.name,
        attendees: activity.attendees ?? 0,
        recruitPostCount: recruitPostCounts.get(activity.legacyId) ?? 0,
      })),
    };
  } finally {
    await mongoose.disconnect();
  }
}
