/** Map sources that v3 Discogs rematch must not overwrite without explicit rematch-mapped. */
export const PROTECTED_LINEUP_MAP_SOURCES = new Set([
  'hermes-v4-web',
  'hermes-v4',
  'hermes-v4-apply',
  'musicbrainz-web',
  'musicbrainz-discogs',
]);

export function isProtectedLineupMapSource(source) {
  return PROTECTED_LINEUP_MAP_SOURCES.has(source?.trim() ?? '');
}
