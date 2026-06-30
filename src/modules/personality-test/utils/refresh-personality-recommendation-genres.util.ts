import { LINEUP_SEED_GENRE_PLACEHOLDER } from '@src/data/itinerary/lineup-seed-genre.constants';
import type { DjService } from '../../dj/dj.service';
import type {
  DjRecommendation,
  PersonalityTestResult,
  RecommendDjLineupResult,
} from '../personality-test.types';

function isPlaceholderGenreLabel(label: string | undefined): boolean {
  const trimmed = label?.trim() ?? '';
  return !trimmed || trimmed === LINEUP_SEED_GENRE_PLACEHOLDER;
}

function collectRecommendationDjNames(
  recommendations: RecommendDjLineupResult,
): string[] {
  const names = [
    recommendations.soulMatch.djName,
    ...recommendations.mustSee.map((entry) => entry.djName),
    ...recommendations.recommended.map((entry) => entry.djName),
    ...recommendations.challenge.map((entry) => entry.djName),
  ];
  return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

function refreshRecommendationGenre(
  recommendation: DjRecommendation,
  genreByName: Map<string, { genre: string; genreLabel: string }>,
): DjRecommendation {
  const display = genreByName.get(recommendation.djName);
  if (!display || isPlaceholderGenreLabel(display.genreLabel)) {
    return recommendation;
  }
  if (recommendation.genreLabel === display.genreLabel) {
    return recommendation;
  }
  return {
    ...recommendation,
    genreLabel: display.genreLabel,
  };
}

function recommendationGenresChanged(
  before: RecommendDjLineupResult,
  after: RecommendDjLineupResult,
): boolean {
  const labels = (recommendations: RecommendDjLineupResult): string[] => [
    recommendations.soulMatch.genreLabel,
    ...recommendations.mustSee.map((entry) => entry.genreLabel),
    ...recommendations.recommended.map((entry) => entry.genreLabel),
    ...recommendations.challenge.map((entry) => entry.genreLabel),
  ];

  const previous = labels(before);
  const next = labels(after);
  return (
    previous.length !== next.length ||
    previous.some((label, index) => label !== next[index])
  );
}

function refreshRecommendationGenresSync(
  recommendations: RecommendDjLineupResult,
  genreByName: Map<string, { genre: string; genreLabel: string }>,
): RecommendDjLineupResult {
  const refresh = (recommendation: DjRecommendation) =>
    refreshRecommendationGenre(recommendation, genreByName);

  const refreshed: RecommendDjLineupResult = {
    soulMatch: refresh(recommendations.soulMatch),
    mustSee: recommendations.mustSee.map(refresh),
    recommended: recommendations.recommended.map(refresh),
    challenge: recommendations.challenge.map(refresh),
  };

  if (!recommendationGenresChanged(recommendations, refreshed)) {
    return recommendations;
  }

  return refreshed;
}

export async function refreshPersonalityRecommendationGenres(
  result: PersonalityTestResult,
  djService: Pick<DjService, 'resolveLineupGenreDisplayForArtists'>,
): Promise<PersonalityTestResult> {
  const names = collectRecommendationDjNames(result.recommendations);
  if (!names.length) {
    return result;
  }

  const genreByName =
    await djService.resolveLineupGenreDisplayForArtists(names);
  const recommendations = refreshRecommendationGenresSync(
    result.recommendations,
    genreByName,
  );

  if (recommendations === result.recommendations) {
    return result;
  }

  return {
    ...result,
    recommendations,
  };
}
