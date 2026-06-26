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

export function isRemoteLineupAvatarUrl(value) {
  const trimmed = value?.trim();
  return Boolean(trimmed && /^https?:\/\//i.test(trimmed));
}

export function isStoredLineupAvatarUrl(value) {
  return isRemoteLineupAvatarUrl(value);
}

/** Remove legacy CloudBase object-key rows (`lineup-avatar/...`). */
export async function purgeLegacyLineupCloudAvatars(db) {
  const result = await db.collection('lineup_artist_avatars').deleteMany({
    avatarUrl: { $regex: '^lineup-avatar/' },
  });
  return result.deletedCount ?? 0;
}

export async function upsertLineupArtistAvatar(db, entry) {
  const artistName = entry.artistName.trim();
  const artistNameKey = artistName.toLowerCase();
  const avatarUrl = entry.avatarUrl.trim();
  if (!artistName || !isRemoteLineupAvatarUrl(avatarUrl)) {
    return false;
  }

  await db.collection('lineup_artist_avatars').updateOne(
    { artistNameKey },
    {
      $set: {
        artistName,
        artistNameKey,
        avatarUrl,
        source: entry.source ?? 'cdn',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  return true;
}
