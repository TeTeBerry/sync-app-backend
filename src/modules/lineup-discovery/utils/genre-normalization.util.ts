/**
 * Canonical genre normalization + related-genre graph.
 * Free-form string comparison is intentionally avoided.
 */

export type RelatedGenre = { genre: string; weight: number };

const ALIAS_TO_CANONICAL: Array<{ pattern: RegExp; canonical: string }> = [
  { pattern: /^melodic[\s_-]*techno$/i, canonical: 'melodic-techno' },
  { pattern: /^progressive[\s_-]*house$/i, canonical: 'progressive-house' },
  { pattern: /^tech[\s_-]*house$/i, canonical: 'tech-house' },
  { pattern: /^deep[\s_-]*house$/i, canonical: 'deep-house' },
  { pattern: /^big[\s_-]*room$/i, canonical: 'big-room' },
  { pattern: /^hard[\s_-]*techno$/i, canonical: 'hard-techno' },
  { pattern: /^industrial[\s_-]*techno$/i, canonical: 'industrial-techno' },
  { pattern: /^drum[\s]*(n|&|and)?[\s_-]*bass$/i, canonical: 'drum-and-bass' },
  { pattern: /^dnb$/i, canonical: 'drum-and-bass' },
  { pattern: /^psy[\s_-]*trance$/i, canonical: 'psytrance' },
  { pattern: /^organic[\s_-]*house$/i, canonical: 'organic-house' },
  { pattern: /^uk[\s_-]*garage$/i, canonical: 'uk-garage' },
  { pattern: /^future[\s_-]*bass$/i, canonical: 'future-bass' },
  { pattern: /^hardstyle$/i, canonical: 'hardstyle' },
  { pattern: /^hardcore$/i, canonical: 'hardcore' },
  { pattern: /^dubstep$/i, canonical: 'dubstep' },
  { pattern: /^trance$/i, canonical: 'trance' },
  { pattern: /^techno$/i, canonical: 'techno' },
  { pattern: /^house$/i, canonical: 'house' },
  { pattern: /^bass(\s*music)?$/i, canonical: 'bass' },
  { pattern: /^indie[\s_-]*dance$/i, canonical: 'indie-dance' },
  { pattern: /^minimal$/i, canonical: 'minimal-techno' },
  { pattern: /^ambient$/i, canonical: 'ambient' },
];

export const RELATED_GENRES: Record<string, RelatedGenre[]> = {
  'melodic-techno': [
    { genre: 'progressive-house', weight: 0.8 },
    { genre: 'indie-dance', weight: 0.55 },
    { genre: 'deep-house', weight: 0.45 },
    { genre: 'techno', weight: 0.5 },
  ],
  'progressive-house': [
    { genre: 'trance', weight: 0.75 },
    { genre: 'melodic-techno', weight: 0.8 },
    { genre: 'big-room', weight: 0.55 },
  ],
  trance: [
    { genre: 'progressive-house', weight: 0.75 },
    { genre: 'psytrance', weight: 0.55 },
    { genre: 'big-room', weight: 0.45 },
  ],
  'big-room': [
    { genre: 'progressive-house', weight: 0.55 },
    { genre: 'trance', weight: 0.45 },
    { genre: 'house', weight: 0.4 },
  ],
  'tech-house': [
    { genre: 'house', weight: 0.8 },
    { genre: 'deep-house', weight: 0.5 },
    { genre: 'techno', weight: 0.35 },
  ],
  house: [
    { genre: 'tech-house', weight: 0.8 },
    { genre: 'deep-house', weight: 0.65 },
    { genre: 'uk-garage', weight: 0.4 },
  ],
  'deep-house': [
    { genre: 'organic-house', weight: 0.7 },
    { genre: 'house', weight: 0.65 },
    { genre: 'melodic-techno', weight: 0.4 },
  ],
  'hard-techno': [
    { genre: 'industrial-techno', weight: 0.85 },
    { genre: 'techno', weight: 0.7 },
    { genre: 'hardstyle', weight: 0.35 },
  ],
  techno: [
    { genre: 'hard-techno', weight: 0.55 },
    { genre: 'minimal-techno', weight: 0.6 },
    { genre: 'melodic-techno', weight: 0.45 },
  ],
  dubstep: [
    { genre: 'bass', weight: 0.85 },
    { genre: 'drum-and-bass', weight: 0.45 },
  ],
  'drum-and-bass': [
    { genre: 'bass', weight: 0.8 },
    { genre: 'dubstep', weight: 0.45 },
  ],
  bass: [
    { genre: 'dubstep', weight: 0.7 },
    { genre: 'future-bass', weight: 0.55 },
    { genre: 'drum-and-bass', weight: 0.55 },
  ],
  hardstyle: [
    { genre: 'hardcore', weight: 0.65 },
    { genre: 'hard-techno', weight: 0.35 },
  ],
};

export function canonicalizeGenre(
  raw: string | undefined | null,
): string | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  for (const token of trimmed.split(/\s*[·/|,]\s*/)) {
    const piece = token.trim();
    if (!piece || piece === '—' || /待补充|placeholder/i.test(piece)) continue;
    for (const rule of ALIAS_TO_CANONICAL) {
      if (rule.pattern.test(piece)) return rule.canonical;
    }
    return piece
      .toLowerCase()
      .replace(/[&]/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
  return null;
}

export function relatedGenreWeight(a: string, b: string): number {
  if (a === b) return 1;
  const left = RELATED_GENRES[a] ?? [];
  const right = RELATED_GENRES[b] ?? [];
  const ab = left.find((item) => item.genre === b)?.weight ?? 0;
  const ba = right.find((item) => item.genre === a)?.weight ?? 0;
  return Math.max(ab, ba);
}

export function areRelatedCanonical(a: string, b: string): boolean {
  return relatedGenreWeight(a, b) >= 0.35;
}
