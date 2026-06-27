const MAX_GENRE_TOKEN_LENGTH = 36;

/** Sources, roles, and other metadata that Hermes sometimes writes into genre facts. */
const NON_GENRE_EXACT = new Set([
  'web',
  'dj',
  'producer',
  'artist',
  'artists',
  'vocalist',
  'live',
  'act',
  'band',
  'group',
  'duo',
  'mc',
  'electronic',
  'dance',
  'pop',
  'beatport',
  'discogs',
  'soundcloud',
  'bandcamp',
  'mixmag',
  'insomniac',
  'facebook',
  'spotify',
  'partyflock',
  'fatsoma',
  'ra',
  'resident advisor',
  'musicbrainz',
  '1001tracklists',
  'scantraxx',
  'q-dance',
  'thai2siam',
  'edmliveset',
]);

const GENRE_LEXICON_SIGNAL =
  /\b(house|techno|trance|dubstep|drum|bass|dnb|garage|hardstyle|hardcore|hard\s*techno|edm|psy|psytrance|breakbeat|ambient|electro|minimal|deep|progressive|melodic|uplifting|acid|industrial|rawstyle|frenchcore|hardtek|uptempo|reggae|hip\s*hop|hip-hop|riddim|neurofunk|big\s*room|tech\s*house|future|trap|brostep|gabber|moombahton|merengue|dembow|latin|afro|disco|synthwave|euro|jump\s*up|jumpup)\b/i;

const ROLE_TOKEN =
  /^(dj|mc|live|act|band|group|duo|artist|producer|vocalist|songwriter)s?$/i;

function hasGenreLexiconSignal(value: string): boolean {
  return GENRE_LEXICON_SIGNAL.test(value);
}

function looksLikeProse(value: string): boolean {
  return (
    /\b(impact|energy|packed|delivering|dancefloor|presence on|transitioned from|billed at|releases on|profile at|open-format|female-friendly|also\s)/i.test(
      value,
    ) ||
    / — /.test(value) ||
    /\be\.g\./i.test(value) ||
    /\b20\d{2}\b/.test(value) ||
    /https?:\/\//i.test(value)
  );
}

function isRoleToken(value: string): boolean {
  return ROLE_TOKEN.test(value.trim());
}

/** True when a token is a real catalog style/genre label (not source, role, or marketing prose). */
export function isCatalogGenreToken(value: string): boolean {
  const trimmed = value.trim();
  if (
    !trimmed ||
    trimmed.length < 2 ||
    trimmed.length > MAX_GENRE_TOKEN_LENGTH
  ) {
    return false;
  }

  const key = trimmed.toLowerCase();
  if (NON_GENRE_EXACT.has(key)) {
    return false;
  }
  if (looksLikeProse(trimmed)) {
    return false;
  }
  if (/[([{]/.test(trimmed) || /['")\]}]\s*$/.test(trimmed)) {
    return false;
  }
  if (isRoleToken(trimmed)) {
    return false;
  }
  if (!hasGenreLexiconSignal(trimmed)) {
    return false;
  }

  const wordCount = trimmed.split(/\s+/).length;
  if (wordCount > 4) {
    return false;
  }

  return true;
}

function inferStyleFromProse(key: string): string {
  if (key.includes('mainstage') || /\bedm\b/.test(key)) {
    return 'Big Room';
  }
  if (key.includes('house') || key.includes('garage')) {
    return 'House';
  }
  if (key.includes('techno') || key.includes('rave')) {
    return 'Techno';
  }
  if (key.includes('trance') || key.includes('psy')) {
    return 'Trance';
  }
  if (key.includes('dubstep') || key.includes('riddim')) {
    return 'Dubstep';
  }
  if (key.includes('drum') && key.includes('bass')) {
    return 'Drum n Bass';
  }
  if (key.includes('hardstyle') || key.includes('hardcore')) {
    return 'Hardstyle';
  }
  if (
    key.includes('future bass') ||
    (key.includes('bass') && !key.includes('house'))
  ) {
    return 'Bass';
  }
  return '';
}

function splitInnerGenreList(value: string): string[] {
  if (value.includes('·') || value.includes('/')) {
    return value.split(/[·/|]/);
  }
  if (value.includes(',')) {
    return value.split(/[,;]/);
  }
  return [value];
}

/** Pull genre-like fragments from a raw Hermes / catalog string. */
export function extractCatalogGenreCandidates(raw: string): string[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.includes('·') && !trimmed.includes('(')) {
    const dotParts = trimmed
      .split(/\s*·\s*/)
      .map((part) => part.trim())
      .filter(Boolean);
    if (dotParts.length > 1) {
      const genreParts = dotParts.filter(
        (part) => hasGenreLexiconSignal(part) && !isRoleToken(part),
      );
      if (genreParts.length > 0) {
        return genreParts;
      }
      if (
        dotParts.every(
          (part) =>
            isRoleToken(part) || NON_GENRE_EXACT.has(part.toLowerCase()),
        )
      ) {
        return [];
      }
    }
  }

  const candidates: string[] = [];

  for (const match of trimmed.matchAll(/\(([^)]{1,240})\)/g)) {
    for (const part of splitInnerGenreList(match[1] ?? '')) {
      const value = part.trim();
      if (value) {
        candidates.push(value);
      }
    }
  }

  const withoutParens = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
  if (shouldSplitGenreList(trimmed)) {
    for (const part of trimmed.split(/[,;/|]/)) {
      const value = part.replace(/\s*\([^)]*\)/g, '').trim();
      if (value) {
        candidates.push(value);
      }
    }
  } else if (withoutParens) {
    candidates.push(withoutParens);
  }

  return candidates;
}

function shouldSplitGenreList(value: string): boolean {
  const withoutParens = value.replace(/\s*\([^)]*\)/g, '').trim();
  if (!/[,;|/]/.test(withoutParens)) {
    return false;
  }
  const parts = withoutParens
    .split(/[,;/|]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return (
    parts.length > 1 &&
    parts.every((part) => part.length <= MAX_GENRE_TOKEN_LENGTH)
  );
}

/** Normalize one extracted candidate to a short display token. */
export function normalizeCatalogGenreToken(raw: string): string {
  const value = raw
    .trim()
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!value) {
    return '';
  }

  const key = value.toLowerCase();
  if (key === 'edm') {
    return 'Big Room';
  }
  if (key === 'bass music') {
    return 'Bass';
  }

  if (value.length > MAX_GENRE_TOKEN_LENGTH || looksLikeProse(value)) {
    return inferStyleFromProse(key);
  }

  return value;
}

/** @deprecated Alias kept for script/tests — prefer normalizeCatalogGenreToken. */
export function normalizeWebOnlyGenreToken(raw: string): string {
  return normalizeCatalogGenreToken(raw);
}

/** Sanitize catalog `styles` / `genres` arrays before lineup display or persistence. */
export function sanitizeCatalogGenreTokens(
  tokens: string[] | undefined,
): string[] {
  const normalized = new Set<string>();

  for (const raw of tokens ?? []) {
    const trimmed = raw.trim();
    if (!trimmed) {
      continue;
    }

    const candidates = extractCatalogGenreCandidates(trimmed);
    let accepted = false;

    for (const candidate of candidates) {
      const token = normalizeCatalogGenreToken(candidate);
      if (token && isCatalogGenreToken(token)) {
        normalized.add(token);
        accepted = true;
      }
    }

    if (
      !accepted &&
      (trimmed.length > MAX_GENRE_TOKEN_LENGTH || looksLikeProse(trimmed))
    ) {
      const inferred = inferStyleFromProse(trimmed.toLowerCase());
      if (inferred) {
        normalized.add(inferred);
      }
    }
  }

  return [...normalized];
}

const WEAK_CATALOG_GENRE_EXACT = new Set(['electronic', 'dance', 'edm', 'pop']);

/** True when sanitized genres/styles carry no specific sub-style signal. */
export function isWeakCatalogGenreList(tokens: string[] | undefined): boolean {
  const sanitized = sanitizeCatalogGenreTokens(tokens);
  if (!sanitized.length) {
    return true;
  }
  return sanitized.every((token) =>
    WEAK_CATALOG_GENRE_EXACT.has(token.toLowerCase()),
  );
}
