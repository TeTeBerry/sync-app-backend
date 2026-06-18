import { RAVER_AVATAR_ASSET_KEYS } from '@src/modules/personality-test/data/personality-avatar-catalog';
import { isRaverAvatarAssetKey } from '@src/modules/personality-test/utils/personality-avatar-ref.util';
import {
  ensurePersonalityResultAvatar,
  generatePersonalityRaverAvatarKey,
} from '@src/modules/personality-test/utils/personality-raver-avatar.util';

describe('personality-raver-avatar.util', () => {
  it('generates keys from avatar catalog', () => {
    expect(generatePersonalityRaverAvatarKey(() => 0)).toBe(
      RAVER_AVATAR_ASSET_KEYS[0],
    );
  });

  it('validates avatar asset keys', () => {
    expect(isRaverAvatarAssetKey('avatar/01.webp')).toBe(true);
    expect(isRaverAvatarAssetKey('avatar/unknown.webp')).toBe(false);
    expect(isRaverAvatarAssetKey('../avatar/01.webp')).toBe(false);
  });

  it('assigns avatar on ensure', () => {
    const next = ensurePersonalityResultAvatar({
      version: 1,
      completedAt: '2026-01-01T00:00:00.000Z',
      answers: {},
      score: {
        primaryType: 'rager',
        scores: {
          rager: 1,
          connoisseur: 0,
          vibe_curator: 0,
          zen_raver: 0,
          documentarian: 0,
        },
      },
      recommendations: {
        soulMatch: {
          djId: 'dj',
          djName: 'DJ',
          genreLabel: 'Techno',
          matchScore: 1,
          soulSimilarity: 1,
          tier: 'must_see',
          dimensionBreakdown: { E: 1, M: 1, S: 1, C: 1 },
        },
        mustSee: [],
        recommended: [],
        challenge: [],
      },
      recommendedEvents: [],
      narrative: { tagline: 't', aiAnalysis: 'a', spiritConnections: [] },
    });
    expect(next.raverAvatarKey).toMatch(/^avatar\//);
  });
});
