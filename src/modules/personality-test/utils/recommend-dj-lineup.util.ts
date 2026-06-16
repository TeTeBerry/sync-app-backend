import type { PersonalityTypeMeta } from '../data/personality-types';
import type {
  DjFeatureVector,
  DjRecommendation,
  MatchDimension,
  PersonalityLineupDj,
  PersonalityScoreResult,
  RecommendDjLineupResult,
  RaverPersonalityType,
} from '../personality-test.types';
import {
  DJ_SOUL_PROFILES,
  EDC_KOREA_PERSONALITY_LINEUP,
  lineupDjId,
} from '../data/personality-lineup';
import { PERSONALITY_TYPE_META } from '../data/personality-types';
import type { DjSoulProfile } from '../data/personality-lineup';
import { normalizeDjName } from './lineup-dj-pool.util';

type RecommendDjLineupOptions = {
  typeMeta?: Record<RaverPersonalityType, PersonalityTypeMeta>;
  soulProfiles?: Record<string, DjSoulProfile>;
  /** Normalized artist names on upcoming festival lineups — receive a score boost. */
  lineupDjNames?: Set<string>;
};

const LINEUP_MATCH_BOOST = 12;

const DIMENSIONS: MatchDimension[] = ['E', 'M', 'S', 'C'];

function inferDjVector(dj: PersonalityLineupDj): DjFeatureVector {
  const genre = `${dj.genre} ${dj.genreLabel}`.toLowerCase();
  if (genre.includes('techno')) return { E: 72, M: 88, S: 35, C: 45 };
  if (genre.includes('trance') || genre.includes('psy'))
    return { E: 68, M: 90, S: 42, C: 48 };
  if (genre.includes('hardstyle') || genre.includes('hard dance'))
    return { E: 92, M: 45, S: 55, C: 70 };
  if (
    genre.includes('dubstep') ||
    genre.includes('bass') ||
    genre.includes('riddim')
  )
    return { E: 88, M: 50, S: 62, C: 78 };
  if (genre.includes('house') || genre.includes('brazilian'))
    return { E: 78, M: 52, S: 88, C: 65 };
  if (genre.includes('trap')) return { E: 85, M: 48, S: 72, C: 82 };
  if (genre.includes('future') || genre.includes('melodic'))
    return { E: 58, M: 72, S: 68, C: 55 };
  if (genre.includes('drum')) return { E: 82, M: 70, S: 50, C: 60 };
  if (genre.includes('big room')) return { E: 90, M: 40, S: 75, C: 72 };
  return { E: 65, M: 60, S: 55, C: 55 };
}

function resolveUserVector(
  score: PersonalityScoreResult,
  typeMeta: Record<RaverPersonalityType, PersonalityTypeMeta>,
): DjFeatureVector {
  const primary = typeMeta[score.primaryType];
  const vector = { ...primary.targetVector };
  if (!score.secondaryType || !score.blendRatio) {
    return vector;
  }
  const secondary = typeMeta[score.secondaryType];
  const { primary: primaryRatio, secondary: secondaryRatio } = score.blendRatio;
  for (const dim of DIMENSIONS) {
    vector[dim] = Math.round(
      (primary.targetVector[dim] * primaryRatio +
        secondary.targetVector[dim] * secondaryRatio) /
        100,
    );
  }
  return vector;
}

function dimensionBreakdown(
  user: DjFeatureVector,
  dj: DjFeatureVector,
): Record<MatchDimension, number> {
  return {
    E: Math.max(0, 100 - Math.abs(user.E - dj.E)),
    M: Math.max(0, 100 - Math.abs(user.M - dj.M)),
    S: Math.max(0, 100 - Math.abs(user.S - dj.S)),
    C: Math.max(0, 100 - Math.abs(user.C - dj.C)),
  };
}

function matchScore(
  user: DjFeatureVector,
  dj: DjFeatureVector,
  type: RaverPersonalityType,
  typeMeta: Record<RaverPersonalityType, PersonalityTypeMeta>,
): number {
  const weights = typeMeta[type].dimensionWeights;
  let weightedSum = 0;
  let weightTotal = 0;
  for (const dim of DIMENSIONS) {
    const weight = weights[dim];
    const diff = user[dim] - dj[dim];
    weightedSum += weight * diff * diff;
    weightTotal += weight;
  }
  const distance = Math.sqrt(weightedSum / Math.max(weightTotal, 1));
  const base = Math.max(0, Math.min(100, 100 - distance * 0.75));
  return Math.round(base);
}

function soulSimilarity(breakdown: Record<MatchDimension, number>): number {
  const values = DIMENSIONS.map((dim) => breakdown[dim]);
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function djHighlight(
  djId: string,
  soulProfiles: Record<string, DjSoulProfile>,
): string | undefined {
  const profile = soulProfiles[djId] ?? DJ_SOUL_PROFILES[djId];
  return profile?.spiritMoments[0];
}

function toRecommendation(
  dj: PersonalityLineupDj,
  score: PersonalityScoreResult,
  userVector: DjFeatureVector,
  tier: DjRecommendation['tier'],
  match: number,
  breakdown: Record<MatchDimension, number>,
  typeMeta: Record<RaverPersonalityType, PersonalityTypeMeta>,
  soulProfiles: Record<string, DjSoulProfile>,
): DjRecommendation {
  return {
    djId: dj.id,
    djName: dj.name,
    genreLabel: dj.genreLabel,
    matchScore: match,
    soulSimilarity: soulSimilarity(breakdown),
    tier,
    dimensionBreakdown: breakdown,
    highlight: djHighlight(dj.id, soulProfiles),
  };
}

export function recommendDjLineup(
  score: PersonalityScoreResult,
  lineup: PersonalityLineupDj[] = EDC_KOREA_PERSONALITY_LINEUP,
  options: RecommendDjLineupOptions = {},
): RecommendDjLineupResult {
  const typeMeta = options.typeMeta ?? PERSONALITY_TYPE_META;
  const soulProfiles = options.soulProfiles ?? DJ_SOUL_PROFILES;
  const lineupDjNames = options.lineupDjNames;
  const userVector = resolveUserVector(score, typeMeta);
  const ranked = lineup
    .map((dj) => {
      const djVector = inferDjVector(dj);
      const breakdown = dimensionBreakdown(userVector, djVector);
      const match = matchScore(
        userVector,
        djVector,
        score.primaryType,
        typeMeta,
      );
      const popularityBoost = Math.round((dj.popularity - 80) * 0.15);
      const lineupBoost =
        (lineupDjNames?.has(normalizeDjName(dj.name)) ?? false)
          ? LINEUP_MATCH_BOOST
          : 0;
      return {
        dj,
        match: Math.min(99, match + Math.max(0, popularityBoost) + lineupBoost),
        breakdown,
        inLineup: lineupBoost > 0,
      };
    })
    .sort((a, b) => {
      if (b.match !== a.match) return b.match - a.match;
      if (a.inLineup !== b.inLineup) return a.inLineup ? -1 : 1;
      return 0;
    });

  const soulMatch = toRecommendation(
    ranked[0].dj,
    score,
    userVector,
    'must_see',
    ranked[0].match,
    ranked[0].breakdown,
    typeMeta,
    soulProfiles,
  );

  const rest = ranked.slice(1);
  const mustSee = rest
    .filter((item) => item.match >= 72)
    .slice(0, 3)
    .map((item) =>
      toRecommendation(
        item.dj,
        score,
        userVector,
        'must_see',
        item.match,
        item.breakdown,
        typeMeta,
        soulProfiles,
      ),
    );

  const recommended = rest
    .filter((item) => item.match >= 58 && item.match < 72)
    .slice(0, 4)
    .map((item) =>
      toRecommendation(
        item.dj,
        score,
        userVector,
        'recommended',
        item.match,
        item.breakdown,
        typeMeta,
        soulProfiles,
      ),
    );

  const challenge = [...rest]
    .reverse()
    .filter((item) => item.match < 58)
    .slice(0, 2)
    .map((item) =>
      toRecommendation(
        item.dj,
        score,
        userVector,
        'challenge',
        item.match,
        item.breakdown,
        typeMeta,
        soulProfiles,
      ),
    );

  if (!recommended.length) {
    recommended.push(
      ...rest
        .filter((item) => !mustSee.some((entry) => entry.djId === item.dj.id))
        .slice(0, 3)
        .map((item) =>
          toRecommendation(
            item.dj,
            score,
            userVector,
            'recommended',
            item.match,
            item.breakdown,
            typeMeta,
            soulProfiles,
          ),
        ),
    );
  }

  return {
    soulMatch,
    mustSee,
    recommended,
    challenge,
  };
}

export { lineupDjId };
