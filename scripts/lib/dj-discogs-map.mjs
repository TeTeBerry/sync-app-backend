import { normalizeArtistNameKey } from './festival-lineup-fallback.mjs';

/** Mongo mapping: festival lineup display name → Discogs artist_id. */
export function createDjDiscogsMapModel(mongoose) {
  const schema = new mongoose.Schema(
    {
      lineupNameKey: { type: String, unique: true, required: true, index: true },
      lineupName: { type: String, required: true },
      discogsId: { type: Number },
      discogsName: { type: String },
      status: {
        type: String,
        enum: ['mapped', 'pending_review'],
        required: true,
        index: true,
      },
      matchScore: { type: Number },
      searchQuery: { type: String },
      discoveryStrategyId: { type: String },
      reviewReason: { type: String },
      source: { type: String },
      candidateScores: {
        type: [
          {
            discogsId: { type: Number, required: true },
            name: { type: String, required: true },
            total: { type: Number, required: true },
          },
        ],
        default: [],
      },
      mappedAt: { type: Date },
      reviewedAt: { type: Date },
    },
    { collection: 'dj_discogs_map', timestamps: true },
  );

  return mongoose.models.DjDiscogsMap ?? mongoose.model('DjDiscogsMap', schema);
}

export function lineupNameKeyFor(lineupName) {
  return normalizeArtistNameKey(lineupName);
}

export async function findDjDiscogsMapEntry(collection, lineupName) {
  const lineupNameKey = lineupNameKeyFor(lineupName);
  if (!lineupNameKey) {
    return null;
  }
  return collection.findOne({ lineupNameKey });
}

export async function deleteDjDiscogsMapEntry(collection, lineupName) {
  const lineupNameKey = lineupNameKeyFor(lineupName);
  if (!lineupNameKey) {
    return null;
  }
  const existing = await collection.findOne({ lineupNameKey });
  if (!existing) {
    return null;
  }
  await collection.deleteOne({ lineupNameKey });
  return existing;
}

export async function upsertDjDiscogsMapMapped(collection, input) {
  const lineupNameKey = lineupNameKeyFor(input.lineupName);
  const now = new Date();
  await collection.updateOne(
    { lineupNameKey },
    {
      $set: {
        lineupName: input.lineupName.trim(),
        discogsId: input.discogsId,
        discogsName: input.discogsName,
        status: 'mapped',
        matchScore: input.matchScore,
        searchQuery: input.searchQuery,
        discoveryStrategyId: input.discoveryStrategyId ?? '',
        reviewReason: '',
        source: input.source ?? '',
        candidateScores: input.candidateScores ?? [],
        mappedAt: now,
        reviewedAt: now,
      },
      $setOnInsert: { lineupNameKey },
    },
    { upsert: true },
  );
}

export async function upsertDjDiscogsMapComboBilling(collection, input) {
  const lineupNameKey = lineupNameKeyFor(input.lineupName);
  const now = new Date();
  const parts = (input.parts ?? []).map((part) => part.trim()).filter(Boolean);

  await collection.updateOne(
    { lineupNameKey },
    {
      $set: {
        lineupName: input.lineupName.trim(),
        status: 'mapped',
        source: 'combo-billing',
        matchScore: 100,
        searchQuery: input.lineupName.trim(),
        reviewReason: input.reviewReason ?? '',
        discoveryStrategyId: 'lineup-split',
        candidateScores: [],
        comboParts: parts,
        mappedAt: now,
        reviewedAt: now,
      },
      $unset: {
        discogsId: '',
        discogsName: '',
      },
      $setOnInsert: { lineupNameKey },
    },
    { upsert: true },
  );
}

export async function upsertDjDiscogsMapPendingReview(collection, input) {
  const lineupNameKey = lineupNameKeyFor(input.lineupName);
  const now = new Date();
  await collection.updateOne(
    { lineupNameKey },
    {
      $set: {
        lineupName: input.lineupName.trim(),
        status: 'pending_review',
        searchQuery: input.searchQuery,
        reviewReason: input.reviewReason,
        source: input.source ?? '',
        candidateScores: input.candidateScores ?? [],
        reviewedAt: now,
      },
      $unset: {
        discogsId: '',
        discogsName: '',
        matchScore: '',
        mappedAt: '',
      },
      $setOnInsert: { lineupNameKey },
    },
    { upsert: true },
  );
}

/**
 * Lineup names confirmed in dj_discogs_map (status=mapped) — safe for avatar lookup.
 * Returns discogsName as the canonical search name for TheAudioDB.
 */
export async function listMappedLineupArtists(mapCollection, lineupNames) {
  const keys = [
    ...new Set(
      lineupNames
        .map((name) => lineupNameKeyFor(name))
        .filter(Boolean),
    ),
  ];
  if (!keys.length) {
    return [];
  }

  const rows = await mapCollection
    .find({
      lineupNameKey: { $in: keys },
      status: 'mapped',
      source: { $ne: 'combo-billing' },
      discogsId: { $exists: true, $ne: null },
    })
    .toArray();
  const byKey = new Map(rows.map((row) => [row.lineupNameKey, row]));

  const targets = [];
  for (const lineupName of lineupNames) {
    const row = byKey.get(lineupNameKeyFor(lineupName));
    if (!row) {
      continue;
    }
    targets.push({
      lineupName,
      discogsId: row.discogsId ?? null,
      searchName: (row.discogsName ?? lineupName).trim() || lineupName,
    });
  }
  return targets;
}

export async function listAllMappedLineupNames(mapCollection) {
  const rows = await mapCollection
    .find({ status: 'mapped', discogsId: { $exists: true } })
    .project({ lineupName: 1 })
    .toArray();
  return rows.map((row) => row.lineupName?.trim()).filter(Boolean);
}
