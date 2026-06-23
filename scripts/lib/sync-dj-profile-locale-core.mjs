import mongoose from 'mongoose';

export async function loadDjProfileLocaleRows(sourceUri) {
  await mongoose.connect(sourceUri);
  const rows = await mongoose.connection.db
    .collection('djs')
    .find(
      {
        discogsId: { $type: 'number' },
        $or: [
          { profileZh: { $exists: true, $nin: ['', null] } },
          { country: { $exists: true, $nin: ['', null] } },
        ],
      },
      {
        projection: {
          discogsId: 1,
          profile: 1,
          profileZh: 1,
          profileZhSource: 1,
          country: 1,
        },
      },
    )
    .toArray();
  await mongoose.disconnect();
  return rows;
}

export async function upsertDjProfileLocaleRows(targetUri, rows) {
  await mongoose.connect(targetUri);
  const collection = mongoose.connection.db.collection('djs');
  let upserted = 0;

  for (const row of rows) {
    if (!Number.isFinite(row.discogsId)) {
      continue;
    }

    const patch = {};
    if (row.country?.trim()) {
      patch.country = row.country.trim();
    }
    if (row.profileZh?.trim()) {
      patch.profileZh = row.profileZh.trim();
      patch.profileZhSource =
        row.profileZhSource?.trim() || row.profile?.trim() || '';
    }

    if (Object.keys(patch).length === 0) {
      continue;
    }

    const result = await collection.updateOne(
      { discogsId: row.discogsId },
      {
        $set: {
          ...patch,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount > 0) {
      upserted += 1;
    }
  }

  const withZh = await collection.countDocuments({
    profileZh: { $exists: true, $nin: ['', null] },
  });
  await mongoose.disconnect();
  return { upserted, withZh };
}

export async function syncDjProfileLocale(sourceUri, targets) {
  const rows = await loadDjProfileLocaleRows(sourceUri);
  const results = [];

  for (const target of targets) {
    const result = await upsertDjProfileLocaleRows(target.uri, rows);
    results.push({ label: target.label, ...result, sourceRows: rows.length });
  }

  return { rows: rows.length, results };
}
