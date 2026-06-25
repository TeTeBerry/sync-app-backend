import {
  buildLineupArtistProfileFallback,
  resolveLineupSeedGenre,
  resolveLineupSeedGenreLabel,
} from '@src/modules/itinerary/domain/lineup-artist-data-policy';

describe('lineup-artist-data-policy', () => {
  it('returns placeholder for empty genreLabel', () => {
    expect(resolveLineupSeedGenreLabel('')).toBe('风格待补充');
    expect(resolveLineupSeedGenreLabel('风格待补充')).toBe('风格待补充');
  });

  it('returns placeholder genre when seed genre is missing', () => {
    expect(resolveLineupSeedGenre('', 'Breakbeat · Downtempo')).toBe(
      '风格待补充',
    );
    expect(resolveLineupSeedGenre('风格待补充', '')).toBe('风格待补充');
  });

  it('does not build genre-based fallback profile when genres are placeholder', () => {
    const fallback = buildLineupArtistProfileFallback({
      name: 'CRUSH',
      genre: '风格待补充',
      genreLabel: '风格待补充',
    });
    expect(fallback.profileSummary).toBeUndefined();
    expect(fallback.representativeTracks).toEqual([]);
  });
});
