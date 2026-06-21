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

export function extensionFromContentType(contentType, fallback = 'jpg') {
  const type = (contentType ?? '').toLowerCase();
  if (type.includes('png')) {
    return 'png';
  }
  if (type.includes('webp')) {
    return 'webp';
  }
  if (type.includes('jpeg') || type.includes('jpg')) {
    return 'jpg';
  }
  return fallback;
}

export async function downloadRemoteImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'SyncElectronicDJAgent/1.0',
      Accept: 'image/*',
    },
  });
  if (!response.ok) {
    throw new Error(`download ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error('empty image');
  }
  return {
    buffer,
    ext: extensionFromContentType(contentType),
  };
}

export function lineupAvatarCloudPath(artistName, ext = 'jpg') {
  const slug = lineupAvatarSlug(artistName) || 'artist';
  return `${LINEUP_AVATAR_CLOUD_PREFIX}${slug}.${ext}`;
}

export async function upsertLineupArtistAvatar(db, entry) {
  const artistName = entry.artistName.trim();
  const artistNameKey = artistName.toLowerCase();
  const avatarUrl = entry.avatarUrl.trim();
  if (!artistName || !avatarUrl || !avatarUrl.startsWith(LINEUP_AVATAR_CLOUD_PREFIX)) {
    return false;
  }

  await db.collection('lineup_artist_avatars').updateOne(
    { artistNameKey },
    {
      $set: {
        artistName,
        artistNameKey,
        avatarUrl,
        source: entry.source ?? 'cloudbase',
        updatedAt: new Date(),
      },
      $setOnInsert: { createdAt: new Date() },
    },
    { upsert: true },
  );
  return true;
}
