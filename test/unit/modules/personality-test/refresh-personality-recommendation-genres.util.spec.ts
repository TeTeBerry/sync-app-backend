import { refreshPersonalityRecommendationGenres } from '@src/modules/personality-test/utils/refresh-personality-recommendation-genres.util';
import type {
  PersonalityTestResult,
  RecommendDjLineupResult,
} from '@src/modules/personality-test/personality-test.types';

const recommendations: RecommendDjLineupResult = {
  soulMatch: {
    djId: 'brennan-heart',
    djName: 'BRENNAN HEART',
    genreLabel: '风格待补充',
    matchScore: 91,
    soulSimilarity: 82,
    tier: 'must_see',
    dimensionBreakdown: { E: 80, M: 70, S: 60, C: 65 },
  },
  mustSee: [],
  recommended: [],
  challenge: [],
};

const baseResult: PersonalityTestResult = {
  version: 1,
  completedAt: '2026-06-29T00:00:00.000Z',
  answers: {},
  score: {
    primaryType: 'rager',
    scores: {
      rager: 80,
      connoisseur: 10,
      vibe_curator: 10,
      zen_raver: 10,
      documentarian: 10,
    },
  },
  recommendations,
  recommendedEvents: [],
  narrative: {
    tagline: 'test',
    aiAnalysis: 'test',
    spiritConnections: [],
  },
};

describe('refresh-personality-recommendation-genres', () => {
  it('replaces placeholder genre labels from catalog display', async () => {
    const refreshed = await refreshPersonalityRecommendationGenres(baseResult, {
      resolveLineupGenreDisplayForArtists: jest
        .fn()
        .mockResolvedValue(
          new Map([
            [
              'BRENNAN HEART',
              { genre: 'Hardstyle', genreLabel: 'Hardstyle · Hard Trance' },
            ],
          ]),
        ),
    });

    expect(refreshed.recommendations.soulMatch.genreLabel).toBe(
      'Hardstyle · Hard Trance',
    );
    expect(refreshed).not.toBe(baseResult);
  });

  it('keeps the original result when catalog still has placeholder', async () => {
    const refreshed = await refreshPersonalityRecommendationGenres(baseResult, {
      resolveLineupGenreDisplayForArtists: jest
        .fn()
        .mockResolvedValue(
          new Map([
            [
              'BRENNAN HEART',
              { genre: '风格待补充', genreLabel: '风格待补充' },
            ],
          ]),
        ),
    });

    expect(refreshed).toBe(baseResult);
  });
});
