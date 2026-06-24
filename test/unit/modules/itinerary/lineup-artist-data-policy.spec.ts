import {
  buildLineupArtistProfileFallback,
  resolveLineupSeedGenre,
  resolveLineupSeedGenreLabel,
} from '@src/modules/itinerary/domain/lineup-artist-data-policy';

describe('lineup-artist-data-policy', () => {
  it('returns seed genreLabel unchanged', () => {
    expect(
      resolveLineupSeedGenreLabel('Future Bass · Melodic Trap · Future House'),
    ).toBe('Future Bass · Melodic Trap · Future House');
  });

  it('prefers seed genre over genreLabel tokens', () => {
    expect(resolveLineupSeedGenre('Future Bass', 'Breakbeat · Downtempo')).toBe(
      'Future Bass',
    );
  });

  it('builds seed-accurate fallback profile when Discogs is skipped', () => {
    const fallback = buildLineupArtistProfileFallback({
      name: 'CRUSH',
      genre: 'Hardstyle',
      genreLabel: 'Hardstyle · Rawstyle',
    });
    expect(fallback.profileSummary).toContain('Hardstyle');
  });
});
