import { normalizeArtistNameKey } from './festival-lineup-fallback.mjs';
import { sanitizeCatalogGenreTokens } from './web-only-genre-normalize.mjs';

/** Reserved synthetic ids for LINEUP_MANUAL_DJ_PROFILES — avoid collision. */
const RESERVED_SYNTHETIC_DISCOGS_IDS = new Set([990000008, 990000009]);

export const WEB_ONLY_DISCOGS_ID_MIN = 990000010;
export const WEB_ONLY_DISCOGS_ID_MAX = 999999999;

export function isSyntheticDiscogsId(discogsId) {
  const id = Number(discogsId);
  return (
    Number.isFinite(id) &&
    id >= WEB_ONLY_DISCOGS_ID_MIN &&
    id <= WEB_ONLY_DISCOGS_ID_MAX
  );
}

export function isHermesWebOnlyMap(row) {
  return (
    row?.status === 'mapped' &&
    (row.source === 'hermes-v4-web' ||
      isSyntheticDiscogsId(row.discogsId) ||
      (!row.discogsId && row.hermesEvidence))
  );
}

function hashLineupNameKey(lineupNameKey) {
  let hash = 0;
  for (let i = 0; i < lineupNameKey.length; i += 1) {
    hash = (Math.imul(31, hash) + lineupNameKey.charCodeAt(i)) >>> 0;
  }
  return hash;
}

/** Stable synthetic Discogs id for web-only Hermes mapped artists. */
export function allocateSyntheticDiscogsId(lineupName) {
  const key = normalizeArtistNameKey(lineupName);
  const span = WEB_ONLY_DISCOGS_ID_MAX - WEB_ONLY_DISCOGS_ID_MIN + 1;
  let id =
    WEB_ONLY_DISCOGS_ID_MIN + (hashLineupNameKey(key || lineupName) % span);

  while (RESERVED_SYNTHETIC_DISCOGS_IDS.has(id)) {
    id += 1;
    if (id > WEB_ONLY_DISCOGS_ID_MAX) {
      id = WEB_ONLY_DISCOGS_ID_MIN;
    }
  }

  return id;
}

function stripMarkdown(text) {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_#>`]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function collectGenreStyles(sourcedFacts = []) {
  const genres = [];
  const styles = [];
  let hadGenreFacts = false;

  for (const fact of sourcedFacts) {
    const claim = (fact.claim ?? '').toLowerCase();
    const value = (fact.value ?? '').trim();
    if (!value) {
      continue;
    }
    if (claim.includes('genre')) {
      hadGenreFacts = true;
      genres.push(...sanitizeCatalogGenreTokens([value]));
    }
    if (claim.includes('style')) {
      hadGenreFacts = true;
      styles.push(...sanitizeCatalogGenreTokens([value]));
    }
  }

  return {
    genres: [...new Set(genres)],
    styles: [...new Set(styles)],
    hadGenreFacts,
  };
}

function buildProfileText(hermesEvidence) {
  const report = hermesEvidence?.integratedReport?.trim();
  if (report) {
    return stripMarkdown(report).substring(0, 600);
  }

  const snippets = (hermesEvidence?.web ?? [])
    .filter((row) => row.relevance === 'high' || row.relevance === 'medium')
    .map((row) => row.snippet?.trim())
    .filter(Boolean);

  return [...new Set(snippets)].join(' ').substring(0, 600);
}

function collectUrls(hermesEvidence) {
  const urls = new Set();
  for (const row of hermesEvidence?.web ?? []) {
    if (row.url?.trim()) {
      urls.add(row.url.trim());
    }
  }
  if (hermesEvidence?.musicbrainz?.url?.trim()) {
    urls.add(hermesEvidence.musicbrainz.url.trim());
  }
  for (const fact of hermesEvidence?.sourcedFacts ?? []) {
    if (fact.sourceUrl?.trim()) {
      urls.add(fact.sourceUrl.trim());
    }
  }
  return [...urls];
}

function resolveCountry(sourcedFacts = []) {
  for (const fact of sourcedFacts) {
    if (/country|origin|based/i.test(fact.claim ?? '')) {
      const value = fact.value?.trim();
      if (value) {
        return value;
      }
    }
  }
  return '';
}

/**
 * Build a djs row from Hermes v4 web-only evidence stored on dj_discogs_map.
 */
export function buildWebOnlyDjRecord({
  lineupName,
  discogsName,
  hermesEvidence,
  discogsId,
}) {
  const profile = buildProfileText(hermesEvidence);
  const { genres, styles, hadGenreFacts } = collectGenreStyles(hermesEvidence?.sourcedFacts);
  const canonicalName = discogsName?.trim() || lineupName.trim();

  return {
    discogsId:
      discogsId ?? allocateSyntheticDiscogsId(lineupName),
    name: canonicalName,
    realName: '',
    profile,
    genres: genres.length ? genres : hadGenreFacts ? [] : ['Electronic'],
    styles,
    country: resolveCountry(hermesEvidence?.sourcedFacts),
    urls: collectUrls(hermesEvidence),
    members: [],
    representativeWorks: [],
    crawledAt: new Date(),
  };
}
