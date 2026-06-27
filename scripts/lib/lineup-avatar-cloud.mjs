export const LINEUP_AVATAR_CLOUD_PREFIX = 'lineup-avatar/';

export function lineupAvatarSlug(artistName) {
  return artistName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
}

export function isLineupAvatarAssetKey(value) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.includes('..')) {
    return false;
  }
  return trimmed.startsWith(LINEUP_AVATAR_CLOUD_PREFIX);
}

const DISCOGS_AVATAR_HOST_RE = /(^|\.)discogs\.com/i;

export function isDiscogsAvatarUrl(value) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return false;
  }
  try {
    return DISCOGS_AVATAR_HOST_RE.test(new URL(trimmed).hostname);
  } catch {
    return DISCOGS_AVATAR_HOST_RE.test(trimmed);
  }
}

export function isRemoteLineupAvatarUrl(value) {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^https?:\/\//i.test(trimmed));
}

export function isUsableLineupAvatarUrl(value, source) {
  if (source?.trim().toLowerCase() === 'discogs') {
    return false;
  }
  return isRemoteLineupAvatarUrl(value) && !isDiscogsAvatarUrl(value);
}

export function isStoredLineupAvatarUrl(value, source) {
  return isUsableLineupAvatarUrl(value, source);
}

/** Remove legacy CloudBase object-key rows (`lineup-avatar/...`). */
export async function purgeLegacyLineupCloudAvatars(db) {
  const result = await db.collection('lineup_artist_avatars').deleteMany({
    avatarUrl: { $regex: '^lineup-avatar/' },
  });
  return result.deletedCount ?? 0;
}

/** Remove Discogs-sourced or Discogs-hosted avatar rows (URLs are unstable). */
export async function purgeDiscogsLineupAvatars(db) {
  const result = await db.collection('lineup_artist_avatars').deleteMany({
    $or: [
      { source: 'discogs' },
      { avatarUrl: { $regex: 'discogs\\.com', $options: 'i' } },
    ],
  });
  return result.deletedCount ?? 0;
}

export async function deleteLineupArtistAvatar(db, artistName) {
  const artistNameKey = artistName.trim().toLowerCase();
  if (!artistNameKey) {
    return false;
  }
  const result = await db
    .collection('lineup_artist_avatars')
    .deleteOne({ artistNameKey });
  return (result.deletedCount ?? 0) > 0;
}

/** Remove avatars saved with review flags (genre_mismatch / low_score). */
export async function purgeReviewFlaggedLineupAvatars(db) {
  const result = await db.collection('lineup_artist_avatars').deleteMany({
    reviewFlag: { $in: ['genre_mismatch', 'low_score'] },
  });
  return result.deletedCount ?? 0;
}

export async function upsertLineupArtistAvatar(db, entry) {
  const artistName = entry.artistName.trim();
  const artistNameKey = artistName.toLowerCase();
  const avatarUrl = entry.avatarUrl.trim();
  if (
    !artistName ||
    !isUsableLineupAvatarUrl(avatarUrl, entry.source ?? 'cdn')
  ) {
    return false;
  }

  const setFields = {
    artistName,
    artistNameKey,
    avatarUrl,
    source: entry.source ?? 'cdn',
    updatedAt: new Date(),
  };

  if (entry.matchScore !== undefined && entry.matchScore !== null) {
    setFields.matchScore = entry.matchScore;
  }
  if (entry.theAudioDbArtist !== undefined) {
    setFields.theAudioDbArtist = entry.theAudioDbArtist;
  }
  if (entry.theAudioDbArtistId !== undefined) {
    setFields.theAudioDbArtistId = entry.theAudioDbArtistId;
  }
  if (Array.isArray(entry.theAudioDbGenres)) {
    setFields.theAudioDbGenres = entry.theAudioDbGenres;
  }
  if (entry.searchQuery !== undefined) {
    setFields.searchQuery = entry.searchQuery;
  }
  if (entry.reviewFlag !== undefined) {
    setFields.reviewFlag = entry.reviewFlag ?? null;
  }

  await db.collection('lineup_artist_avatars').updateOne(
    { artistNameKey },
    {
      $set: setFields,
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  return true;
}
