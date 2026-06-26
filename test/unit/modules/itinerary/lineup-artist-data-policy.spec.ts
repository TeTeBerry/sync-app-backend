import {
  buildLineupArtistProfileFallback,
  resolveLineupDisplayGenreFromCatalog,
  resolveLineupSeedGenre,
  resolveLineupSeedGenreLabel,
} from '@src/modules/itinerary/domain/lineup-artist-data-policy';

describe('lineup-artist-data-policy', () => {
  it('returns placeholder for empty genreLabel', () => {
    expect(resolveLineupSeedGenreLabel('')).toBe('风格待补充');
    expect(resolveLineupSeedGenreLabel('风格待补充')).toBe('风格待补充');
  });

  it('uses Discogs catalog styles for lineup display', () => {
    expect(
      resolveLineupDisplayGenreFromCatalog([
        { styles: ['Tech House', 'Deep House'], genres: ['Electronic'] },
      ]),
    ).toEqual({
      genre: 'Tech House',
      genreLabel: 'Tech House · Deep House',
    });
  });

  it('returns placeholder when catalog has no styles or genres', () => {
    expect(resolveLineupDisplayGenreFromCatalog([])).toEqual({
      genre: '风格待补充',
      genreLabel: '风格待补充',
    });
    expect(
      resolveLineupDisplayGenreFromCatalog([{ styles: [], genres: [] }]),
    ).toEqual({
      genre: '风格待补充',
      genreLabel: '风格待补充',
    });
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
