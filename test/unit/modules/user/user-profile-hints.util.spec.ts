import {
  buildBuddyPostProfileHints,
  buildTravelGuideProfileHints,
  extractProfileGenresFromText,
  mergeUserProfileHints,
  travelGuideBudgetTierToProfileLevel,
  userMatchProfilesEqual,
} from '@src/modules/user/user-profile-hints.util';

describe('user-profile-hints.util', () => {
  it('buildBuddyPostProfileHints maps location and buddy intent', () => {
    const hints = buildBuddyPostProfileHints({
      body: '找组队，6.13-6.14，上海，2人',
      location: '上海',
      tags: ['#组队'],
      contentTypes: ['team'],
    });

    expect(hints.city).toBe('上海');
    expect(hints.likeMate).toBe(true);
  });

  it('extracts favorGenres from post body', () => {
    const hints = buildBuddyPostProfileHints({
      body: '上海出发，喜欢 techno 和 house',
      location: '上海',
      tags: ['#组队'],
      contentTypes: ['team'],
    });

    expect(hints.favorGenres).toEqual(
      expect.arrayContaining(['Techno', 'House']),
    );
  });

  it('prefers compound genres over substring matches', () => {
    const genres = extractProfileGenresFromText(
      '只听 tech house 和 melodic techno',
    );
    expect(genres).toEqual(
      expect.arrayContaining(['Tech House', 'Melodic Techno']),
    );
    expect(genres).not.toContain('House');
  });

  it('extracts genres from Chinese and dnb shorthand', () => {
    const genres = extractProfileGenresFromText('浩室入门，后来转 dnb 和硬派');
    expect(genres).toEqual(
      expect.arrayContaining(['House', 'Drum and Bass', 'Hardstyle']),
    );
  });

  it('buildTravelGuideProfileHints maps city and budget tier', () => {
    const hints = buildTravelGuideProfileHints({
      departure: '上海虹桥站',
      departureCity: '上海市',
      budgetTier: 'comfort',
      headcount: 2,
    });

    expect(hints.city).toBe('上海');
    expect(hints.budgetLevel).toBe('high');
    expect(hints.likeMate).toBe(true);
  });

  it('travelGuideBudgetTierToProfileLevel maps tiers', () => {
    expect(travelGuideBudgetTierToProfileLevel('economy')).toBe('low');
    expect(travelGuideBudgetTierToProfileLevel('standard')).toBe('medium');
    expect(travelGuideBudgetTierToProfileLevel('comfort')).toBe('high');
  });

  it('mergeUserProfileHints unions genres without dropping city', () => {
    const merged = mergeUserProfileHints(
      { city: '北京', favorGenres: ['Edm'] },
      { favorGenres: ['Techno'], budgetLevel: 'medium' },
    );

    expect(merged.city).toBe('北京');
    expect(merged.favorGenres).toEqual(
      expect.arrayContaining(['Edm', 'Techno']),
    );
    expect(merged.budgetLevel).toBe('medium');
  });

  it('userMatchProfilesEqual compares genre sets order-insensitively', () => {
    expect(
      userMatchProfilesEqual(
        { favorGenres: ['Techno', 'Edm'] },
        { favorGenres: ['Edm', 'Techno'] },
      ),
    ).toBe(true);
  });
});
