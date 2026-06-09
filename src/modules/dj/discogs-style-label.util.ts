import type { DjCatalogItem } from './dj.types';

const MAX_STYLE_PARTS = 4;
const STYLE_PLACEHOLDER = '风格待补充';

export function mergeDiscogsStyleLabels(
  items: Array<Pick<DjCatalogItem, 'styles' | 'genres'>>,
): string {
  const styles = new Set<string>();
  for (const item of items) {
    for (const style of item.styles ?? []) {
      const trimmed = style.trim();
      if (trimmed) {
        styles.add(trimmed);
      }
    }
  }
  if (styles.size) {
    return [...styles].slice(0, MAX_STYLE_PARTS).join(' · ');
  }

  const genres = new Set<string>();
  for (const item of items) {
    for (const genre of item.genres ?? []) {
      const trimmed = genre.trim();
      if (trimmed) {
        genres.add(trimmed);
      }
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
  const styles = (item.styles ?? [])
    .map((style) => style.trim())
    .filter(Boolean)
    .slice(0, MAX_STYLE_PARTS)
    .join(' · ');
  if (styles) {
    return styles;
  }

  const genres = (item.genres ?? [])
    .map((genre) => genre.trim())
    .filter(Boolean)
    .slice(0, MAX_STYLE_PARTS)
    .join(' · ');
  return genres || STYLE_PLACEHOLDER;
}
