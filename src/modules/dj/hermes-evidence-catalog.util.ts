import type { DjCatalogItem } from './dj.types';
import {
  sanitizeCatalogGenreTokens,
  isWeakCatalogGenreList,
} from './web-only-genre-normalize.util';

export type HermesSourcedFact = {
  claim?: string;
  value?: string;
  source?: string;
  sourceUrl?: string;
};

export type HermesWebEvidence = {
  source?: string;
  url?: string;
  snippet?: string;
  relevance?: 'high' | 'medium' | 'low' | string;
};

export type HermesEvidencePayload = {
  web?: HermesWebEvidence[];
  musicbrainz?: { name?: string; url?: string };
  sourcedFacts?: HermesSourcedFact[];
  integratedReport?: string;
};

function stripMarkdown(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Collect genre/style tokens from all Hermes evidence fields. */
export function catalogGenresFromHermesEvidence(
  evidence: HermesEvidencePayload | null | undefined,
): { genres: string[]; styles: string[] } {
  const texts: string[] = [];

  for (const fact of evidence?.sourcedFacts ?? []) {
    const claim = (fact.claim ?? '').toLowerCase();
    const value = (fact.value ?? '').trim();
    if (!value) {
      continue;
    }
    if (
      claim.includes('genre') ||
      claim.includes('style') ||
      claim.includes('hint')
    ) {
      texts.push(value);
    }
  }

  const report = evidence?.integratedReport?.trim();
  if (report) {
    texts.push(report);
  }

  const tokens = new Set<string>();
  for (const text of texts) {
    for (const token of sanitizeCatalogGenreTokens([text])) {
      tokens.add(token);
    }
  }

  const genres = [...tokens];
  return { genres, styles: genres };
}

export function catalogProfileFromHermesEvidence(
  evidence: HermesEvidencePayload | null | undefined,
): string | undefined {
  const report = evidence?.integratedReport?.trim();
  if (report) {
    return stripMarkdown(report).substring(0, 600);
  }

  const snippets = (evidence?.web ?? [])
    .filter((row) => row.relevance === 'high' || row.relevance === 'medium')
    .map((row) => row.snippet?.trim())
    .filter((snippet): snippet is string => Boolean(snippet));

  const joined = [...new Set(snippets)].join(' ').trim();
  return joined ? joined.substring(0, 600) : undefined;
}

export function enrichCatalogItemFromHermesEvidence(
  item: DjCatalogItem,
  evidence: HermesEvidencePayload | null | undefined,
): DjCatalogItem {
  if (!evidence) {
    return item;
  }

  const fromEvidence = catalogGenresFromHermesEvidence(evidence);
  const existingGenresWeak = isWeakCatalogGenreList(item.genres);
  const existingStylesWeak = isWeakCatalogGenreList(item.styles);
  const genres =
    !existingGenresWeak && sanitizeCatalogGenreTokens(item.genres).length > 0
      ? item.genres
      : fromEvidence.genres;
  const styles =
    !existingStylesWeak && sanitizeCatalogGenreTokens(item.styles).length > 0
      ? item.styles
      : fromEvidence.styles.length
        ? fromEvidence.styles
        : fromEvidence.genres;

  const profile =
    item.profile?.trim() || catalogProfileFromHermesEvidence(evidence);

  const urls = [
    ...new Set([
      ...(item.urls ?? []),
      ...collectUrlsFromHermesEvidence(evidence),
    ]),
  ].filter(Boolean);

  return {
    ...item,
    genres,
    styles,
    ...(profile ? { profile } : {}),
    ...(urls.length ? { urls } : {}),
  };
}

function collectUrlsFromHermesEvidence(
  evidence: HermesEvidencePayload | null | undefined,
): string[] {
  const urls: string[] = [];
  for (const row of evidence?.web ?? []) {
    if (row.url?.trim()) {
      urls.push(row.url.trim());
    }
  }
  if (evidence?.musicbrainz?.url?.trim()) {
    urls.push(evidence.musicbrainz.url.trim());
  }
  for (const fact of evidence?.sourcedFacts ?? []) {
    if (fact.sourceUrl?.trim()) {
      urls.push(fact.sourceUrl.trim());
    }
  }
  return urls;
}

export function catalogItemFromHermesMapRow(row: {
  lineupName: string;
  discogsName?: string;
  discogsId?: number;
  hermesEvidence?: HermesEvidencePayload;
  displayGenres?: string[];
  displayStyles?: string[];
}): DjCatalogItem | null {
  if (!row.discogsId) {
    return null;
  }

  const precomputed =
    row.displayGenres?.length || row.displayStyles?.length
      ? {
          genres: row.displayGenres ?? [],
          styles: row.displayStyles ?? row.displayGenres ?? [],
        }
      : null;

  const base: DjCatalogItem = {
    discogsId: row.discogsId,
    name: row.discogsName?.trim() || row.lineupName.trim(),
    genres: precomputed?.genres ?? [],
    styles: precomputed?.styles ?? [],
  };

  if (row.hermesEvidence) {
    return enrichCatalogItemFromHermesEvidence(base, row.hermesEvidence);
  }

  return precomputed ? base : null;
}

export function precomputeDisplayGenresFromEvidence(
  evidence: HermesEvidencePayload | null | undefined,
): { displayGenres: string[]; displayStyles: string[] } {
  const { genres, styles } = catalogGenresFromHermesEvidence(evidence);
  return { displayGenres: genres, displayStyles: styles };
}
