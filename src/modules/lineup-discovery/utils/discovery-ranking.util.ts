import {
  areRelatedCanonical,
  canonicalizeGenre,
  relatedGenreWeight,
} from './genre-normalization.util';
import { DISCOVERY_SCORE_WEIGHTS } from './taste-weights';

export type LineupDjInput = {
  id: string;
  name: string;
  genre?: string;
  genreLabel?: string;
  popularity?: number;
  genreColor?: string;
};

export type TasteAffinity = {
  artistScores: Record<string, number>;
  genreScores: Record<string, number>;
  hasSignals: boolean;
  mode: 'personalized' | 'session-personalized' | 'festival-fallback';
};

export type DiscoveryReasonKey =
  | 'similar_saved'
  | 'shared_genre'
  | 'adjacent_genre'
  | 'lineup_overlap'
  | 'journey_overlap'
  | 'mood_fit'
  | 'festival_highlight'
  | 'high_energy_bridge'
  | 'wildcard_bridge';

export type RankedDiscoveryArtist = {
  artistId: string;
  name: string;
  primaryGenre?: string;
  genreColor?: string;
  score: number;
  label:
    | 'picked'
    | 'strong'
    | 'related'
    | 'similar_saved'
    | 'discovery'
    | 'wildcard'
    | 'mood';
  category: 'picked' | 'discovery' | 'wildcard';
  reasons: DiscoveryReasonKey[];
  relatedToArtistIds: string[];
};

export type DiscoveryRankingResult = {
  mode: TasteAffinity['mode'];
  pickedForYou: RankedDiscoveryArtist[];
  newDiscoveries: RankedDiscoveryArtist[];
  wildcard?: RankedDiscoveryArtist;
  summary: {
    pickedCount: number;
    discoveryCount: number;
    wildcardCount: number;
  };
};

const MOOD_PATTERNS: Record<string, RegExp> = {
  euphoric: /trance|big-room|progressive|festival|euphor|uplifting|house/i,
  dreamy: /melodic|ambient|progressive|organic|chill|indie/i,
  heavy: /hard|bass|dubstep|riddim|hardstyle|hardcore|drum/i,
  dark: /techno|industrial|minimal|dark|acid/i,
  groovy: /house|disco|garage|funk|jackin|afro/i,
  emotional: /melodic|progressive|trance|cinematic|emotional/i,
  peak: /big-room|mainstage|festival|trance|hardstyle|peak/i,
  underground: /techno|minimal|warehouse|underground|acid|industrial/i,
};

function genreOf(dj: LineupDjInput): string | null {
  return canonicalizeGenre(dj.genreLabel || dj.genre);
}

function fitsMood(canonical: string | null, mood?: string | null): boolean {
  if (!mood) return true;
  if (!canonical) return mood === 'euphoric';
  return Boolean(MOOD_PATTERNS[mood]?.test(canonical));
}

function topSavedArtists(affinity: TasteAffinity, limit = 5): string[] {
  return Object.entries(affinity.artistScores)
    .filter(([, score]) => score > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

/**
 * Deterministic discovery ranking — no LLM.
 * Categories use distinct selection rules (not one sliced list).
 */
export function rankLineupDiscovery(input: {
  roster: LineupDjInput[];
  affinity: TasteAffinity;
  mood?: string | null;
  limit?: number;
}): DiscoveryRankingResult {
  const limit = input.limit ?? 4;
  const savedArtistIds = new Set(
    Object.keys(input.affinity.artistScores).filter(
      (id) => (input.affinity.artistScores[id] ?? 0) > 0,
    ),
  );
  const topSaved = topSavedArtists(input.affinity);
  const genreEntries = Object.entries(input.affinity.genreScores).sort(
    (a, b) => b[1] - a[1],
  );
  const topGenres = genreEntries.slice(0, 4).map(([g]) => g);

  const candidates = input.roster.filter((dj) => !savedArtistIds.has(dj.id));

  const scored = candidates.map((dj) => {
    const genre = genreOf(dj);
    const reasons: DiscoveryReasonKey[] = [];
    const relatedTo: string[] = [];
    let explicit = 0;
    let genreSim = 0;
    let related = 0;
    let lineupOverlap = 0;
    let recency = 0;
    let discoveryBonus = 0;

    if (input.affinity.hasSignals) {
      for (const [savedId, score] of Object.entries(
        input.affinity.artistScores,
      )) {
        if (score <= 0) continue;
        // Same-id already filtered; affinity to saved artists via shared genre
        void savedId;
      }
      for (const [g, score] of genreEntries) {
        if (!genre) break;
        if (g === genre) {
          genreSim = Math.max(genreSim, Math.min(1, score));
          reasons.push('shared_genre');
          relatedTo.push(...topSaved.slice(0, 2));
        } else {
          const bridge = relatedGenreWeight(g, genre);
          if (bridge > related) {
            related = bridge * Math.min(1, score);
            if (bridge >= 0.35) reasons.push('adjacent_genre');
          }
        }
      }
      if (genreSim > 0 || related > 0) {
        explicit = Math.min(1, genreSim * 0.7 + related * 0.5);
        reasons.unshift('similar_saved');
        lineupOverlap = Math.min(1, explicit);
      }
      if (topSaved.length) recency = 0.4;
      discoveryBonus = related > genreSim ? 0.35 : 0.1;
    } else {
      const pop = Math.min(1, (dj.popularity ?? 50) / 100);
      genreSim = pop * 0.5;
      reasons.push('festival_highlight');
      discoveryBonus = 0.2;
    }

    if (input.mood && fitsMood(genre, input.mood)) {
      discoveryBonus += 0.25;
      reasons.push('mood_fit');
    } else if (input.mood && !fitsMood(genre, input.mood)) {
      discoveryBonus -= 0.2;
    }

    const w = DISCOVERY_SCORE_WEIGHTS;
    const score =
      w.explicitAffinity * explicit +
      w.lineupJourneyOverlap * lineupOverlap +
      w.genreSimilarity * genreSim +
      w.relatedGenre * related +
      w.recency * recency +
      w.discoveryBonus * Math.max(0, discoveryBonus) +
      Math.min(0.08, ((dj.popularity ?? 0) / 100) * 0.08);

    let label: RankedDiscoveryArtist['label'] = 'related';
    if (!input.affinity.hasSignals) label = 'related';
    else if (genreSim >= 0.7) label = 'similar_saved';
    else if (score >= 0.55) label = 'strong';
    else if (input.mood && fitsMood(genre, input.mood)) label = 'mood';
    else if (related >= 0.45) label = 'related';

    return {
      artistId: dj.id,
      name: dj.name,
      primaryGenre: dj.genreLabel || dj.genre,
      genreColor: dj.genreColor,
      score,
      label,
      category: 'picked' as const,
      reasons: [...new Set(reasons)].slice(0, 3),
      relatedToArtistIds: [...new Set(relatedTo)].slice(0, 3),
      _genre: genre,
      _related: related,
      _genreSim: genreSim,
    };
  });

  scored.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

  const pickedThreshold = input.affinity.hasSignals ? 0.22 : 0.05;
  const pickedForYou = scored
    .filter((item) => item.score >= pickedThreshold)
    .slice(0, limit)
    .map((item) => ({
      ...item,
      category: 'picked' as const,
      label:
        item.label === 'mood' || item.label === 'related'
          ? input.affinity.hasSignals
            ? ('similar_saved' as const)
            : ('related' as const)
          : item.label,
    }));

  const pickedIds = new Set(pickedForYou.map((item) => item.artistId));

  const newDiscoveries = scored
    .filter((item) => !pickedIds.has(item.artistId))
    .filter((item) => {
      if (!input.affinity.hasSignals) return true;
      return item._related >= 0.3 || item._genreSim >= 0.2 || item.score >= 0.2;
    })
    .slice(0, Math.max(3, limit - 1))
    .map((item) => ({
      artistId: item.artistId,
      name: item.name,
      primaryGenre: item.primaryGenre,
      genreColor: item.genreColor,
      score: item.score,
      label: 'discovery' as const,
      category: 'discovery' as const,
      reasons: item.reasons.includes('adjacent_genre')
        ? item.reasons
        : (['adjacent_genre', ...item.reasons].slice(
            0,
            3,
          ) as DiscoveryReasonKey[]),
      relatedToArtistIds: item.relatedToArtistIds,
    }));

  const discoveryIds = new Set(newDiscoveries.map((item) => item.artistId));

  const wildcardCandidate = scored.find((item) => {
    if (pickedIds.has(item.artistId) || discoveryIds.has(item.artistId)) {
      return false;
    }
    const energetic =
      Boolean(item._genre) &&
      /hard|bass|trance|techno|big-room|festival|peak|hardstyle/i.test(
        item._genre!,
      );
    if (input.affinity.hasSignals) {
      return (energetic && item.score >= 0.12) || item._related >= 0.25;
    }
    return energetic || (item.score ?? 0) > 0.1;
  });

  const wildcard = wildcardCandidate
    ? {
        artistId: wildcardCandidate.artistId,
        name: wildcardCandidate.name,
        primaryGenre: wildcardCandidate.primaryGenre,
        genreColor: wildcardCandidate.genreColor,
        score: wildcardCandidate.score,
        label: 'wildcard' as const,
        category: 'wildcard' as const,
        reasons: [
          'wildcard_bridge',
          ...(wildcardCandidate.reasons.includes('high_energy_bridge')
            ? []
            : (['high_energy_bridge'] as DiscoveryReasonKey[])),
          ...wildcardCandidate.reasons,
        ].slice(0, 3) as DiscoveryReasonKey[],
        relatedToArtistIds: wildcardCandidate.relatedToArtistIds,
      }
    : undefined;

  // Ensure no duplicates across categories
  const used = new Set<string>([
    ...pickedForYou.map((a) => a.artistId),
    ...newDiscoveries.map((a) => a.artistId),
  ]);
  const safeWildcard =
    wildcard && !used.has(wildcard.artistId) ? wildcard : undefined;

  return {
    mode: input.affinity.mode,
    pickedForYou: pickedForYou.map(
      ({ _genre, _related, _genreSim, ...rest }) => rest,
    ),
    newDiscoveries,
    wildcard: safeWildcard,
    summary: {
      pickedCount: pickedForYou.length,
      discoveryCount: newDiscoveries.length,
      wildcardCount: safeWildcard ? 1 : 0,
    },
  };
}

export function buildAffinityFromSignals(input: {
  artistWeights: Record<string, number>;
  genreWeights: Record<string, number>;
  authenticated: boolean;
  hasClientSignals: boolean;
}): TasteAffinity {
  const hasSignals =
    Object.values(input.artistWeights).some((v) => v > 0) ||
    Object.values(input.genreWeights).some((v) => v > 0);
  return {
    artistScores: input.artistWeights,
    genreScores: input.genreWeights,
    hasSignals,
    mode: !hasSignals
      ? 'festival-fallback'
      : input.authenticated
        ? 'personalized'
        : input.hasClientSignals
          ? 'session-personalized'
          : 'personalized',
  };
}

export { areRelatedCanonical, canonicalizeGenre };
