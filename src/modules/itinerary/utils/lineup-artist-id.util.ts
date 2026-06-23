/** Slug id shared with catalog lineup artist list (`GET /activities/lineup-artists`). */
export function artistIdFromLineupName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

const PROFILE_SUMMARY_MAX_LEN = 120;

export function truncateCatalogProfileSummary(
  profile?: string,
): string | undefined {
  const trimmed = profile?.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= PROFILE_SUMMARY_MAX_LEN) {
    return trimmed;
  }
  return `${trimmed.slice(0, PROFILE_SUMMARY_MAX_LEN).trimEnd()}…`;
}
