import { normalizeArtistNameKey } from './lineup-name-match.util';

type LineupCatalogProfile = {
  name: string;
  realName?: string;
  profile?: string;
};

export function isLineupNameUsedAsAliasInProfile(
  lineupName: string,
  profile: string,
): boolean {
  const trimmed = lineupName.trim();
  if (!trimmed) {
    return false;
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const aliasPatterns = [
    new RegExp(`艺名\\s*[「"']?${escaped}[」"']?`, 'i'),
    new RegExp(`亦称[「"']?${escaped}[」"']?`, 'i'),
    new RegExp(
      `(?:also known as|known as|stage name)\\s+[「"']?${escaped}[」"']?`,
      'i',
    ),
  ];
  return aliasPatterns.some((pattern) => pattern.test(profile));
}

export function extractProfilePrimaryName(profile: string): string | undefined {
  const trimmed = profile.trim();
  const zhMatch = trimmed.match(
    /^([A-Za-z][\w\s.'-]{1,50}?)\s+(?:是|為|，|,)/u,
  );
  if (zhMatch?.[1]) {
    return zhMatch[1].trim();
  }

  const enMatch = trimmed.match(/^([A-Za-z][\w\s.'-]{1,50}?)\s+is\b/i);
  return enMatch?.[1]?.trim();
}

export function profileLeadsWithLineupName(
  lineupName: string,
  profile: string,
): boolean {
  const trimmed = lineupName.trim();
  if (!trimmed) {
    return false;
  }

  const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}(?:[（(]|\\s|，|,|。|.)`, 'i').test(
    profile.trim(),
  );
}

/** Discogs stub pages that point at another artist id. */
export function isDiscogsDisambiguationProfile(profile: string): boolean {
  return /(?:For the|please use|use)\s+.*?\[a=?[\d]+/i.test(profile.trim());
}

export function catalogNameTrustKeys(name: string): string[] {
  const trimmed = name.trim();
  const keys = [normalizeArtistNameKey(trimmed)];
  const withoutSuffix = trimmed.replace(/\s*\(\d+\)\s*$/, '').trim();
  if (withoutSuffix && withoutSuffix !== trimmed) {
    keys.push(normalizeArtistNameKey(withoutSuffix));
  }
  return [...new Set(keys.filter(Boolean))];
}

/** Name-key match for genre/catalog lookup (profile not required). */
export function isLineupCatalogNameTrusted(
  lineupName: string,
  catalogItem: LineupCatalogProfile,
  options?: { allowedCatalogNames?: string[] },
): boolean {
  const lineupKey = normalizeArtistNameKey(lineupName);
  const allowedKeys = new Set(
    [
      lineupKey,
      ...(options?.allowedCatalogNames ?? []).map(normalizeArtistNameKey),
    ].filter(Boolean),
  );

  return catalogNameTrustKeys(catalogItem.name).some((key) =>
    allowedKeys.has(key),
  );
}

/** Reject Discogs rows where the bio clearly describes a different person. */
export function isLineupCatalogProfileTrusted(
  lineupName: string,
  catalogItem: LineupCatalogProfile,
  options?: { allowedCatalogNames?: string[] },
): boolean {
  const lineupKey = normalizeArtistNameKey(lineupName);
  const allowedKeys = new Set(
    [
      lineupKey,
      ...(options?.allowedCatalogNames ?? []).map(normalizeArtistNameKey),
    ].filter(Boolean),
  );

  if (
    !catalogNameTrustKeys(catalogItem.name).some((key) => allowedKeys.has(key))
  ) {
    return false;
  }

  const profile = catalogItem.profile?.trim() ?? '';
  if (!profile) {
    return false;
  }

  if (isDiscogsDisambiguationProfile(profile)) {
    return false;
  }

  if (profileLeadsWithLineupName(lineupName, profile)) {
    return true;
  }

  const primaryName = extractProfilePrimaryName(profile);
  if (primaryName) {
    const primaryKey = normalizeArtistNameKey(primaryName);
    if (primaryKey && !allowedKeys.has(primaryKey)) {
      return false;
    }
  }

  if (isLineupNameUsedAsAliasInProfile(lineupName, profile) && primaryName) {
    const primaryKey = normalizeArtistNameKey(primaryName);
    if (primaryKey && !allowedKeys.has(primaryKey)) {
      return false;
    }
  }

  return true;
}
