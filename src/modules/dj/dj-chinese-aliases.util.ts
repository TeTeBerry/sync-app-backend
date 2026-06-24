import { DJ_CHINESE_ALIASES } from './data/dj-chinese-aliases.data';
import { normalizeArtistNameKey } from './lineup-name-match.util';

type AliasIndex = {
  byArtistKey: Map<string, string[]>;
  byAliasKey: Map<string, string>;
};

let cachedIndex: AliasIndex | null = null;

function buildAliasIndex(): AliasIndex {
  const byArtistKey = new Map<string, string[]>();
  const byAliasKey = new Map<string, string>();

  for (const entry of DJ_CHINESE_ALIASES) {
    const artistKey = normalizeArtistNameKey(entry.canonicalName);
    byArtistKey.set(artistKey, entry.aliases);
    for (const alias of entry.aliases) {
      byAliasKey.set(normalizeChineseAliasKey(alias), entry.canonicalName);
    }
  }

  return { byArtistKey, byAliasKey };
}

function getAliasIndex(): AliasIndex {
  cachedIndex ??= buildAliasIndex();
  return cachedIndex;
}

export function normalizeChineseAliasKey(text: string): string {
  return text.trim().toLowerCase();
}

export function getChineseAliasesForArtistName(name: string): string[] {
  const key = normalizeArtistNameKey(name.trim());
  if (!key) {
    return [];
  }
  return getAliasIndex().byArtistKey.get(key) ?? [];
}

export function resolveCanonicalNameFromChineseAlias(
  query: string,
): string | null {
  const trimmed = query.trim();
  if (!trimmed) {
    return null;
  }
  return (
    getAliasIndex().byAliasKey.get(normalizeChineseAliasKey(trimmed)) ?? null
  );
}

export function resolveArtistSearchQuery(query: string): string {
  return resolveCanonicalNameFromChineseAlias(query) ?? query.trim();
}

export function chineseAliasMatchesQuery(
  aliases: string[] | undefined,
  query: string,
): boolean {
  const trimmed = query.trim();
  if (!trimmed || !aliases?.length) {
    return false;
  }
  const normalizedQuery = normalizeChineseAliasKey(trimmed);
  return aliases.some((alias) =>
    normalizeChineseAliasKey(alias).includes(normalizedQuery),
  );
}
