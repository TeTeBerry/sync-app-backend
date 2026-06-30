import {
  inferDepartureCityFromText,
  normalizeCityName,
} from '../partner/utils/departure-city.util';

export interface UserMatchProfile {
  city?: string;
  favorGenres?: string[];
  budgetLevel?: string;
}

export type UserMatchProfileHints = Partial<UserMatchProfile>;

/** English/multi-word needles; longest first when matching substrings. */
const PROFILE_GENRE_SUBSTRING_MATCHERS: ReadonlyArray<{
  needle: string;
  label: string;
}> = [
  { needle: 'drum and bass', label: 'Drum and Bass' },
  { needle: 'drum & bass', label: 'Drum and Bass' },
  { needle: 'progressive trance', label: 'Progressive Trance' },
  { needle: 'uplifting trance', label: 'Uplifting Trance' },
  { needle: 'progressive house', label: 'Progressive House' },
  { needle: 'electro house', label: 'Electro House' },
  { needle: 'future house', label: 'Future House' },
  { needle: 'melodic house', label: 'Melodic House' },
  { needle: 'tropical house', label: 'Tropical House' },
  { needle: 'deep house', label: 'Deep House' },
  { needle: 'tech house', label: 'Tech House' },
  { needle: 'acid house', label: 'Acid House' },
  { needle: 'bass house', label: 'Bass House' },
  { needle: 'afro house', label: 'Afro House' },
  { needle: 'future bass', label: 'Future Bass' },
  { needle: 'melodic dubstep', label: 'Melodic Dubstep' },
  { needle: 'melodic techno', label: 'Melodic Techno' },
  { needle: 'industrial techno', label: 'Industrial Techno' },
  { needle: 'minimal techno', label: 'Minimal Techno' },
  { needle: 'hard techno', label: 'Hard Techno' },
  { needle: 'acid techno', label: 'Acid Techno' },
  { needle: 'detroit techno', label: 'Detroit Techno' },
  { needle: 'happy hardcore', label: 'Happy Hardcore' },
  { needle: 'uk hardcore', label: 'UK Hardcore' },
  { needle: 'speed garage', label: 'Speed Garage' },
  { needle: 'uk garage', label: 'UK Garage' },
  { needle: 'future garage', label: 'Future Garage' },
  { needle: 'witch house', label: 'Witch House' },
  { needle: 'jersey club', label: 'Jersey Club' },
  { needle: 'slap house', label: 'Slap House' },
  { needle: 'slaphouse', label: 'Slap House' },
  { needle: 'big room', label: 'Big Room' },
  { needle: 'goa trance', label: 'Goa Trance' },
  { needle: 'psy trance', label: 'Psytrance' },
  { needle: 'psytrance', label: 'Psytrance' },
  { needle: 'hardstyle', label: 'Hardstyle' },
  { needle: 'hardcore', label: 'Hardcore' },
  { needle: 'dubstep', label: 'Dubstep' },
  { needle: 'breakbeat', label: 'Breakbeat' },
  { needle: 'moombahton', label: 'Moombahton' },
  { needle: 'synthwave', label: 'Synthwave' },
  { needle: 'retrowave', label: 'Retrowave' },
  { needle: 'vaporwave', label: 'Vaporwave' },
  { needle: 'rawstyle', label: 'Rawstyle' },
  { needle: 'riddim', label: 'Riddim' },
  { needle: 'brostep', label: 'Brostep' },
  { needle: 'gabber', label: 'Gabber' },
  { needle: 'drumstep', label: 'Drumstep' },
  { needle: 'footwork', label: 'Footwork' },
  { needle: 'phonk', label: 'Phonk' },
  { needle: 'techno', label: 'Techno' },
  { needle: 'trance', label: 'Trance' },
  { needle: 'house', label: 'House' },
  { needle: 'dub', label: 'Dub' },
  { needle: 'breaks', label: 'Breaks' },
  { needle: 'jungle', label: 'Jungle' },
  { needle: 'garage', label: 'Garage' },
  { needle: 'electro', label: 'Electro' },
  { needle: 'industrial', label: 'Industrial' },
  { needle: 'ambient', label: 'Ambient' },
  { needle: 'midtempo', label: 'Midtempo' },
  { needle: 'trap', label: 'Trap' },
  { needle: 'bass', label: 'Bass' },
  { needle: 'edm', label: 'Edm' },
].sort((a, b) => b.needle.length - a.needle.length);

/** Short tokens that need word boundaries to reduce false positives. */
const PROFILE_GENRE_WORD_MATCHERS: ReadonlyArray<{
  pattern: RegExp;
  label: string;
}> = [
  { pattern: /\bdnb\b/i, label: 'Drum and Bass' },
  { pattern: /\bukg\b/i, label: 'UK Garage' },
  { pattern: /\bidm\b/i, label: 'IDM' },
];

/** Common Chinese festival / scene terms. */
const PROFILE_GENRE_CHINESE_MATCHERS: ReadonlyArray<{
  pattern: RegExp;
  label: string;
}> = [
  { pattern: /鼓打贝斯|鼓打bass/i, label: 'Drum and Bass' },
  { pattern: /回响贝斯|回响 bass/i, label: 'Dubstep' },
  { pattern: /浩室|深浩|科技浩室|铁克浩室/i, label: 'House' },
  { pattern: /科技舞曲|铁克诺|泰克诺/i, label: 'Techno' },
  { pattern: /迷幻舞曲|迷幻 trance/i, label: 'Trance' },
  { pattern: /出神|psy|goa/i, label: 'Psytrance' },
  { pattern: /硬派|hardstyle/i, label: 'Hardstyle' },
  { pattern: /硬核(?!说唱)/i, label: 'Hardcore' },
  { pattern: /低音音乐|bass music/i, label: 'Bass' },
  { pattern: /商业edm|big ?room|大房间/i, label: 'Big Room' },
  { pattern: /未来贝斯/i, label: 'Future Bass' },
  { pattern: /深屋|深 house/i, label: 'Deep House' },
  { pattern: /技术屋|tech house/i, label: 'Tech House' },
];

export function normalizeProfileGenres(raw?: string[]): string[] {
  const genres = new Set<string>();
  for (const item of raw ?? []) {
    const trimmed = item.trim();
    if (!trimmed) continue;
    const normalized = trimmed.replace(/^#/, '');
    genres.add(
      normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase(),
    );
  }
  return [...genres];
}

export function normalizeProfileBudgetLevel(raw?: string): string | undefined {
  const value = raw?.trim().toLowerCase();
  if (!value) return undefined;
  if (value === 'low' || value === 'medium' || value === 'high') return value;
  if (/低/.test(value)) return 'low';
  if (/高/.test(value)) return 'high';
  if (/中/.test(value)) return 'medium';
  return undefined;
}

export function extractProfileGenresFromText(text: string): string[] {
  const found = new Set<string>();
  const lower = text.toLowerCase();
  const matchedNeedles: string[] = [];

  for (const { needle, label } of PROFILE_GENRE_SUBSTRING_MATCHERS) {
    if (!lower.includes(needle)) continue;
    if (
      matchedNeedles.some(
        (longer) => longer !== needle && longer.includes(needle),
      )
    ) {
      continue;
    }
    matchedNeedles.push(needle);
    found.add(label);
  }

  for (const { pattern, label } of PROFILE_GENRE_WORD_MATCHERS) {
    if (pattern.test(text)) {
      found.add(label);
    }
  }

  for (const { pattern, label } of PROFILE_GENRE_CHINESE_MATCHERS) {
    if (pattern.test(text)) {
      found.add(label);
    }
  }

  return [...found];
}

export function travelGuideBudgetTierToProfileLevel(
  tier: 'economy' | 'standard' | 'comfort',
): 'low' | 'medium' | 'high' {
  if (tier === 'economy') return 'low';
  if (tier === 'comfort') return 'high';
  return 'medium';
}

export function mergeUserProfileHints(
  existing: UserMatchProfile | undefined,
  hints: UserMatchProfileHints,
): UserMatchProfile {
  const merged: UserMatchProfile = { ...(existing ?? {}) };

  const city = hints.city?.trim();
  if (city) merged.city = city;

  const genres = normalizeProfileGenres(hints.favorGenres);
  if (genres.length) {
    const combined = new Set([
      ...(merged.favorGenres ?? []).map((g) => g.toLowerCase()),
      ...genres.map((g) => g.toLowerCase()),
    ]);
    merged.favorGenres = [...combined].map(
      (g) => g.charAt(0).toUpperCase() + g.slice(1),
    );
  }

  const budgetLevel = normalizeProfileBudgetLevel(hints.budgetLevel);
  if (budgetLevel) merged.budgetLevel = budgetLevel;

  return merged;
}

export function userMatchProfilesEqual(
  left: UserMatchProfile | undefined,
  right: UserMatchProfile,
): boolean {
  const leftCity = left?.city?.trim() ?? '';
  const rightCity = right.city?.trim() ?? '';
  if (leftCity !== rightCity) return false;

  const leftGenres = (left?.favorGenres ?? [])
    .map((g) => g.toLowerCase())
    .sort()
    .join(',');
  const rightGenres = (right.favorGenres ?? [])
    .map((g) => g.toLowerCase())
    .sort()
    .join(',');
  if (leftGenres !== rightGenres) return false;

  const leftBudget = left?.budgetLevel?.trim() ?? '';
  const rightBudget = right.budgetLevel?.trim() ?? '';
  return leftBudget === rightBudget;
}

export function hasUserMatchProfileHints(
  hints: UserMatchProfileHints,
): boolean {
  return Boolean(
    hints.city?.trim() ||
    (hints.favorGenres?.length ?? 0) > 0 ||
    hints.budgetLevel,
  );
}

export function buildPersonalityProfileHints(params: {
  primaryType: string;
  typeMeta: Record<string, { genreTags: string[] }>;
}): UserMatchProfileHints {
  const tags = params.typeMeta[params.primaryType]?.genreTags ?? [];
  const genres = normalizeProfileGenres(tags);
  return genres.length ? { favorGenres: genres } : {};
}

export function buildTravelGuideProfileHints(params: {
  departure: string;
  departureCity?: string;
  budgetTier?: 'economy' | 'standard' | 'comfort';
}): UserMatchProfileHints {
  const city =
    normalizeCityName(params.departureCity) ??
    normalizeCityName(params.departure) ??
    inferDepartureCityFromText(params.departure, params.departureCity);

  const hints: UserMatchProfileHints = {};
  if (city) hints.city = city;
  if (params.budgetTier) {
    hints.budgetLevel = travelGuideBudgetTierToProfileLevel(params.budgetTier);
  }

  return hints;
}

export function buildSetVoteProfileHints(params: {
  genres: string[];
}): UserMatchProfileHints {
  const favorGenres = normalizeProfileGenres(params.genres);
  return favorGenres.length ? { favorGenres } : {};
}
