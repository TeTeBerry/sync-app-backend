import {
  ensurePersonalityResultNickname,
  generatePersonalityNickname,
  isCurrentPersonalityNicknameFormat,
  isValidPersonalityRaverNicknameQuery,
  PERSONALITY_NICKNAME_CORES,
} from '@src/modules/personality-test/utils/personality-nickname.util';
import { RAVER_PERSONALITY_TYPES } from '@src/modules/personality-test/data/personality-types';

describe('personality-nickname.util', () => {
  it('covers every raver personality type', () => {
    for (const type of RAVER_PERSONALITY_TYPES) {
      expect(PERSONALITY_NICKNAME_CORES[type].length).toBeGreaterThan(0);
      const nickname = generatePersonalityNickname(type, () => 0);
      expect(nickname.length).toBeGreaterThan(6);
      expect(isCurrentPersonalityNicknameFormat(nickname)).toBe(true);
    }
  });

  it('regenerates legacy nickname without id suffix', () => {
    const legacy = {
      version: 1 as const,
      completedAt: '2026-01-01T00:00:00.000Z',
      answers: {},
      score: {
        primaryType: 'rager' as const,
        scores: {
          rager: 90,
          connoisseur: 10,
          vibe_curator: 10,
          zen_raver: 10,
          documentarian: 10,
        },
      },
      recommendations: {
        soulMatch: {
          djId: 'dj-1',
          djName: 'Test DJ',
          genreLabel: 'Techno',
          matchScore: 90,
          soulSimilarity: 88,
          tier: 'must_see' as const,
          dimensionBreakdown: { E: 1, M: 1, S: 1, C: 1 },
        },
        mustSee: [],
        recommended: [],
        challenge: [],
      },
      recommendedEvents: [],
      narrative: {
        tagline: 'tag',
        aiAnalysis: 'analysis',
        spiritConnections: [],
      },
      raverNickname: '小拳皇酱',
    };

    const next = ensurePersonalityResultNickname(legacy);
    expect(next.raverNickname).not.toBe('小拳皇酱');
    expect(isCurrentPersonalityNicknameFormat(next.raverNickname ?? '')).toBe(
      true,
    );
  });

  it('validates nickname usage query input', () => {
    expect(isValidPersonalityRaverNicknameQuery('小滤波酱A1B2')).toBe(true);
    expect(isValidPersonalityRaverNicknameQuery('阿DROP宝K9P1')).toBe(true);
    expect(isValidPersonalityRaverNicknameQuery('')).toBe(false);
    expect(isValidPersonalityRaverNicknameQuery('bad nick')).toBe(false);
    expect(isValidPersonalityRaverNicknameQuery('<script>')).toBe(false);
  });
});
