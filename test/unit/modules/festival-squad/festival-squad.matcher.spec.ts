import { FestivalSquadMatcher } from '@src/modules/festival-squad/festival-squad.matcher';

describe('FestivalSquadMatcher', () => {
  const matcher = new FestivalSquadMatcher();
  const base = {
    eventId: 21,
    arrivalDate: '2026-07-20',
    accommodationType: 'camping',
    budgetLevel: 'comfort',
    originCity: 'Berlin',
    originCountry: 'Germany',
    favoriteArtistIds: ['artist-a', 'artist-b'],
    favoriteArtists: ['Artist A', 'Artist B'],
    favoriteGenres: ['techno'],
    lookingFor: ['festival_buddy'],
  };
  it('returns deterministic scored reason codes for shared travel and music preferences', () => {
    const result = matcher.match(base, {
      ...base,
      favoriteArtistIds: ['artist-a'],
      favoriteArtists: ['Artist A'],
      favoriteGenres: ['techno', 'house'],
    });
    expect(result.score).toBe(89);
    expect(result.label).toBe('excellent');
    expect(result.reasons).toContain('sameArrivalDay');
    expect(result.sharedArtists).toEqual(['Artist A']);
    expect(result.sharedGenres).toEqual(['techno']);
  });
  it('does not award cross-festival matches', () => {
    const result = matcher.match(base, {
      ...base,
      eventId: 22,
      favoriteArtistIds: [],
      favoriteArtists: [],
      favoriteGenres: [],
      lookingFor: [],
    });
    expect(result.reasons).not.toContain('sameFestival');
    expect(result.score).toBe(53);
  });
});
