import type { DjCatalogItem } from './dj.types';
import { sanitizeCatalogGenreTokens } from './web-only-genre-normalize.util';

const MAX_STYLE_PARTS = 4;
const STYLE_PLACEHOLDER = '风格待补充';

export function mergeDiscogsStyleLabels(
  items: Array<Pick<DjCatalogItem, 'styles' | 'genres'>>,
): string {
  const styles = new Set<string>();
  for (const item of items) {
    for (const style of sanitizeCatalogGenreTokens(item.styles)) {
      styles.add(style);
    }
  }
  if (styles.size) {
    return [...styles].slice(0, MAX_STYLE_PARTS).join(' · ');
  }

  const genres = new Set<string>();
  for (const item of items) {
    for (const genre of sanitizeCatalogGenreTokens(item.genres)) {
      genres.add(genre);
    }
  }
  if (genres.size) {
    return [...genres].slice(0, MAX_STYLE_PARTS).join(' · ');
  }

  return STYLE_PLACEHOLDER;
}

export function formatDiscogsStyleLabel(
  item: Pick<DjCatalogItem, 'styles' | 'genres'>,
): string {
  const styles = sanitizeCatalogGenreTokens(item.styles)
    .slice(0, MAX_STYLE_PARTS)
    .join(' · ');
  if (styles) {
    return styles;
  }

  const genres = sanitizeCatalogGenreTokens(item.genres)
    .slice(0, MAX_STYLE_PARTS)
    .join(' · ');
  return genres || STYLE_PLACEHOLDER;
}
