import { RAVER_AVATAR_ASSET_KEYS } from '@src/modules/personality-test/data/personality-avatar-catalog';
import { ensurePersonalityResultIdentity } from '@src/modules/personality-test/utils/personality-result-identity.util';
import type { PersonalityTestResult } from '@src/modules/personality-test/personality-test.types';

const baseResult: PersonalityTestResult = {
  version: 1,
  completedAt: '2026-01-01T00:00:00.000Z',
  answers: {},
  score: {
    primaryType: 'rager',
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
      tier: 'must_see',
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
};

describe('personality-result-identity.util', () => {
  it('re-randomizes avatar when migrating legacy identity', () => {
    const legacy = {
      ...baseResult,
      raverNickname: '小滤波酱A1B2',
      raverAvatarKey: 'avatar/03.webp',
    };

    const next = ensurePersonalityResultIdentity(legacy);
    expect(next.raverAvatarKey).not.toBe('avatar/03.webp');
    expect(RAVER_AVATAR_ASSET_KEYS).toContain(next.raverAvatarKey);
    expect(next.raverIdentityVersion).toBe(2);
    expect(next.raverNickname).toBe('小滤波酱A1B2');
  });

  it('preserves avatar after identity migration', () => {
    const current = {
      ...baseResult,
      raverNickname: '小滤波酱A1B2',
      raverAvatarKey: RAVER_AVATAR_ASSET_KEYS[0],
      raverIdentityVersion: 2,
    };

    const next = ensurePersonalityResultIdentity(current);
    expect(next.raverAvatarKey).toBe(RAVER_AVATAR_ASSET_KEYS[0]);
    expect(next.raverNickname).toBe('小滤波酱A1B2');
  });
});
