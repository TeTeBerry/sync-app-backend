/**
 * Fetch a public image URL from Discogs artist page (for lineup avatar upload).
 */
export function pickDiscogsArtistImageUrl(artist) {
  const images = Array.isArray(artist?.images) ? artist.images : [];
  if (!images.length) {
    return null;
  }

  const primary = images.find((item) => item?.type === 'primary') ?? images[0];
  const url =
    primary?.uri?.trim() ||
    primary?.resource_url?.trim() ||
    primary?.uri150?.trim() ||
    '';
  return url || null;
}

export async function fetchDiscogsArtistImageUrl(discogsId, options = {}) {
  const id = Number(discogsId);
  if (!Number.isFinite(id) || id <= 0) {
    return null;
  }

  const token = options.discogsToken?.trim() ?? '';
  if (!token) {
    return null;
  }

  const delayMs = Number(options.requestDelayMs ?? 1200);
  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  const response = await fetch(`https://api.discogs.com/artists/${id}`, {
    headers: {
      Authorization: `Discogs token=${token}`,
      'User-Agent': options.userAgent ?? 'SyncLineupAvatarSync/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`Discogs ${response.status}: ${response.statusText}`);
  }

  const artist = await response.json();
  const url = pickDiscogsArtistImageUrl(artist);
  if (!url) {
    return null;
  }

  return {
    url,
    source: 'discogs',
    discogsName: artist?.name?.trim() || '',
  };
}
