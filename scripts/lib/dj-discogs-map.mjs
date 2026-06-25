import { normalizeArtistNameKey } from './festival-lineup-fallback.mjs';

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
      reviewReason: { type: String },
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
  return collection.findOne({ lineupNameKey }).lean();
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
        reviewReason: '',
        candidateScores: input.candidateScores ?? [],
        mappedAt: now,
        reviewedAt: now,
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
