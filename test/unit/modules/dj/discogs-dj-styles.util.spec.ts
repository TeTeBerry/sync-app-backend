import {
  aggregateDiscogsReleaseStyles,
  isIrrelevantDiscogsTag,
} from '@src/modules/dj/discogs-dj-styles.util';

describe('discogs-dj-styles.util', () => {
  it('filters pop/rock and ranks styles by frequency', () => {
    const result = aggregateDiscogsReleaseStyles(
      [
        {
          genres: ['Electronic', 'Pop'],
          styles: ['Techno', 'Pop Rock', 'Techno', 'Hard Techno'],
        },
        {
          genres: ['Electronic', 'Rock'],
          styles: ['Techno', 'Melodic Techno', 'Hard Techno'],
        },
        {
          genres: ['Electronic'],
          styles: ['Melodic Techno', 'Techno'],
        },
      ],
      { topStyles: 3 },
    );

    expect(result.styles).toEqual(['Techno', 'Hard Techno', 'Melodic Techno']);
    expect(result.genres).toEqual(['Electronic']);
  });

  it('dedupes genres without a top limit', () => {
    const result = aggregateDiscogsReleaseStyles([
      { genres: ['Electronic', 'Hip Hop'], styles: [] },
      { genres: ['Electronic', 'Hip Hop'], styles: [] },
    ]);

    expect(result.genres).toEqual(['Electronic', 'Hip Hop']);
  });

  it('marks obvious non-electronic tags as irrelevant', () => {
    expect(isIrrelevantDiscogsTag('Pop')).toBe(true);
    expect(isIrrelevantDiscogsTag('Rock')).toBe(true);
    expect(isIrrelevantDiscogsTag('Techno')).toBe(false);
  });
});
