/** Pick the best public CDN URL from a Discogs artist `images` array. */
export function pickDiscogsArtistImageUrl(images) {
  if (!Array.isArray(images) || !images.length) {
    return '';
  }
  const primary = images.find((item) => item?.type === 'primary') ?? images[0];
  return (primary?.uri ?? primary?.uri150 ?? '').trim();
}
