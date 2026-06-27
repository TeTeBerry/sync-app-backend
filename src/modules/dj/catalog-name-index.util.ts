import type { DjCatalogItem } from './dj.types';
import {
  DISCOGS_LINEUP_SEARCH_ALIASES,
  getLineupCoverageKeys,
  normalizeArtistNameKey,
} from './lineup-name-match.util';

/** Reject ultra-short normalized keys that cause false catalog hits (e.g. "me", "t"). */
export const MIN_LINEUP_COVERAGE_KEY_LENGTH = 3;

export function isUsableLineupCoverageKey(key: string): boolean {
  return key.length >= MIN_LINEUP_COVERAGE_KEY_LENGTH;
}

/** In-memory index: normalized name key → catalog row. */
export function buildCatalogNameIndex(
  catalog: DjCatalogItem[],
): Map<string, DjCatalogItem> {
  const index = new Map<string, DjCatalogItem>();

  for (const item of catalog) {
    const djKey = normalizeArtistNameKey(item.name);
    if (djKey && isUsableLineupCoverageKey(djKey) && !index.has(djKey)) {
      index.set(djKey, item);
    }
  }

  for (const [lineupUpper, alias] of Object.entries(
    DISCOGS_LINEUP_SEARCH_ALIASES,
  )) {
    const aliasKey = normalizeArtistNameKey(alias);
    if (!aliasKey || !isUsableLineupCoverageKey(aliasKey)) {
      continue;
    }
    const hit = catalog.find(
      (item) => normalizeArtistNameKey(item.name) === aliasKey,
    );
    if (hit) {
      const lineupKey = normalizeArtistNameKey(lineupUpper);
      if (lineupKey && isUsableLineupCoverageKey(lineupKey)) {
        index.set(lineupKey, hit);
      }
    }
  }

  return index;
}

export function matchLineupArtistToCatalogIndex(
  lineupName: string,
  index: Map<string, DjCatalogItem>,
): DjCatalogItem | null {
  const trimmed = lineupName.trim();
  if (!trimmed) {
    return null;
  }

  const alias = DISCOGS_LINEUP_SEARCH_ALIASES[trimmed.toUpperCase()];
  if (alias) {
    const aliasKey = normalizeArtistNameKey(alias);
    if (aliasKey && isUsableLineupCoverageKey(aliasKey)) {
      const aliasHit = index.get(aliasKey);
      if (aliasHit) {
        return aliasHit;
      }
    }
  }

  const targetKeys = getLineupCoverageKeys(trimmed).filter(
    isUsableLineupCoverageKey,
  );
  if (!targetKeys.length) {
    return null;
  }

  for (const targetKey of targetKeys) {
    const hit = index.get(targetKey);
    if (hit) {
      return hit;
    }
  }

  return null;
}
