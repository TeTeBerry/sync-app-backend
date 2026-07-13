import { canonicalizeGenre } from './genre-normalization.util';
import type { LineupDjInput } from './discovery-ranking.util';

export type FestivalDnaDimension = {
  key: string;
  label: string;
  strength: number;
  confidence: 'high' | 'medium' | 'low';
  explanation: string;
};

const DNA_RULES: Array<{
  key: string;
  label: string;
  pattern: RegExp;
  explanationStrong: string;
  explanationSoft: string;
}> = [
  {
    key: 'melodic',
    label: 'Melodic',
    pattern: /melodic|progressive|cinematic/,
    explanationStrong: 'Strong melodic presence across the cast.',
    explanationSoft: 'A soft melodic undercurrent.',
  },
  {
    key: 'euphoric',
    label: 'Euphoric',
    pattern: /trance|uplifting|big-room|festival/,
    explanationStrong: 'High euphoric energy in the lineup.',
    explanationSoft: 'Euphoria at the edges of the night.',
  },
  {
    key: 'high_energy',
    label: 'High Energy',
    pattern: /hardstyle|hardcore|bass|peak|big-room|festival/,
    explanationStrong: 'High-energy lineup voltage.',
    explanationSoft: 'High energy appears in pockets.',
  },
  {
    key: 'underground',
    label: 'Underground',
    pattern: /techno|minimal|industrial|acid|warehouse/,
    explanationStrong: 'Clear underground current.',
    explanationSoft: 'Underground air between rooms.',
  },
  {
    key: 'hard',
    label: 'Hard',
    pattern: /hard|hardstyle|hardcore|hard-techno/,
    explanationStrong: 'Heavy impact throughout.',
    explanationSoft: 'Harder hits appear in pockets.',
  },
  {
    key: 'groovy',
    label: 'Groovy',
    pattern: /house|disco|garage|funk|afro/,
    explanationStrong: 'Groovy pulse across the night.',
    explanationSoft: 'Groove as a side current.',
  },
  {
    key: 'mainstage',
    label: 'Mainstage',
    pattern: /big-room|festival|trance|hardstyle/,
    explanationStrong: 'Mainstage voltage present.',
    explanationSoft: 'Mainstage air at the margins.',
  },
];

/**
 * Festival DNA from lineup data only — independent of user taste.
 */
export function buildFestivalDna(roster: LineupDjInput[]): {
  dimensions: FestivalDnaDimension[];
  summary: string[];
  dataCoverage: { artistCount: number; enrichedArtistCount: number };
} {
  const weights = new Map<string, number>();
  let enriched = 0;
  for (const dj of roster) {
    const genre = canonicalizeGenre(dj.genreLabel || dj.genre);
    if (!genre) continue;
    enriched += 1;
    for (const rule of DNA_RULES) {
      if (rule.pattern.test(genre)) {
        weights.set(rule.key, (weights.get(rule.key) ?? 0) + 1);
      }
    }
  }

  const artistCount = roster.length;
  const coverageRatio = artistCount ? enriched / artistCount : 0;
  const baseConfidence: FestivalDnaDimension['confidence'] =
    coverageRatio >= 0.7 ? 'high' : coverageRatio >= 0.35 ? 'medium' : 'low';

  const dimensions: FestivalDnaDimension[] = [];
  for (const rule of DNA_RULES) {
    const count = weights.get(rule.key) ?? 0;
    if (count <= 0) continue;
    const strength = artistCount
      ? Math.min(1, count / Math.max(1, artistCount))
      : 0;
    if (strength < 0.08 && count < 2) continue;
    dimensions.push({
      key: rule.key,
      label: rule.label,
      strength: Math.round(strength * 100) / 100,
      confidence: baseConfidence,
      explanation:
        strength >= 0.22 ? rule.explanationStrong : rule.explanationSoft,
    });
  }

  dimensions.sort((a, b) => b.strength - a.strength);
  const top = dimensions.slice(0, 5);
  const summary = top.slice(0, 3).map((d) => d.explanation);

  if (
    top.some((d) => d.key === 'underground') &&
    top.some((d) => d.key === 'mainstage')
  ) {
    summary.unshift('Balanced underground and mainstage sound.');
  }

  return {
    dimensions: top,
    summary: [...new Set(summary)].slice(0, 4),
    dataCoverage: { artistCount, enrichedArtistCount: enriched },
  };
}
