export function maskMongoUri(value) {
  return value.replace(/:([^:@/]+)@/, ':***@');
}

async function countDocuments(collection) {
  try {
    return await collection.countDocuments();
  } catch {
    return 0;
  }
}

/** Wipe registrations and zero out per-activity attendee totals. */
export async function resetAttendeeCounts(db, { dryRun = false } = {}) {
  const activities = db.collection('activities');
  const registrations = db.collection('activityregistrations');

  const registrationCount = await countDocuments(registrations);
  const activityCount = await countDocuments(activities);

  if (dryRun) {
    return { registrationCount, activityCount, dryRun: true };
  }

  const regResult = await registrations.deleteMany({});
  const actResult = await activities.updateMany({}, { $set: { attendees: 0 } });

  return {
    registrationCount: regResult.deletedCount ?? registrationCount,
    activityCount: actResult.modifiedCount ?? activityCount,
    dryRun: false,
  };
}

export async function listActivityAttendees(db) {
  return db
    .collection('activities')
    .find({})
    .project({ legacyId: 1, name: 1, attendees: 1 })
    .toArray();
}
