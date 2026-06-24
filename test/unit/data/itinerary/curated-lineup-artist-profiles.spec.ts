import { resolveCuratedLineupArtistProfile } from '@src/data/itinerary/curated-lineup-artist-profiles';

describe('curated-lineup-artist-profiles', () => {
  it('returns undefined when no curated row exists', () => {
    expect(resolveCuratedLineupArtistProfile('MARSHMELLO')).toBeUndefined();
    expect(resolveCuratedLineupArtistProfile('CRUSH')).toBeUndefined();
  });
});
