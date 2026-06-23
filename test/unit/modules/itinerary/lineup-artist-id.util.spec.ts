import {
  artistIdFromLineupName,
  truncateCatalogProfileSummary,
} from '@src/modules/itinerary/utils/lineup-artist-id.util';

describe('lineup-artist-id.util', () => {
  it('builds stable slug ids from artist names', () => {
    expect(artistIdFromLineupName('DJ SNAKE')).toBe('dj-snake');
    expect(artistIdFromLineupName('Dimitri Vegas & Like Mike')).toBe(
      'dimitri-vegas-and-like-mike',
    );
  });

  it('truncates long catalog profile summaries', () => {
    const long = 'a'.repeat(150);
    expect(truncateCatalogProfileSummary(long)?.endsWith('…')).toBe(true);
    expect(truncateCatalogProfileSummary('short bio')).toBe('short bio');
    expect(truncateCatalogProfileSummary('   ')).toBeUndefined();
  });
});
