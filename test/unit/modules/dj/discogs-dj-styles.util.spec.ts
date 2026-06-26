import {
  aggregateDiscogsReleaseStyles,
  isIrrelevantDiscogsTag,
  pickReleasesForStyleSampling,
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
    expect(isIrrelevantDiscogsTag('Dance-pop')).toBe(true);
    expect(isIrrelevantDiscogsTag('Techno')).toBe(false);
  });

  it('rolls house subgenres into House for ranking', () => {
    const result = aggregateDiscogsReleaseStyles(
      [
        { styles: ['Tech House'] },
        { styles: ['Tech House', 'Electro House'] },
        { styles: ['Progressive House'] },
      ],
      { topStyles: 3 },
    );

    expect(result.styles).toEqual(['Tech House', 'House', 'Progressive House']);
  });

  it('prefers recent Main-role releases when sampling', () => {
    const picked = pickReleasesForStyleSampling(
      [
        { title: 'Old', year: 2013, role: 'Main' },
        { title: 'Remix', year: 2025, role: 'Remix' },
        { title: 'New A', year: 2025, role: 'Main' },
        { title: 'New B', year: 2024, role: 'Main' },
        { title: 'New C', year: 2023, role: 'Main' },
      ],
      3,
    );

    expect(picked.map((item) => item.title)).toEqual([
      'New A',
      'New B',
      'New C',
    ]);
  });

  it('aggregates Odd Mob-like recent releases toward House / Tech House / Progressive House', () => {
    const result = aggregateDiscogsReleaseStyles(
      [
        { styles: ['Progressive House', 'UK Garage'] },
        { styles: ['Dance-pop'] },
        { styles: ['Tech House'] },
        { styles: ['Electro House'] },
        { styles: ['Dance-pop'] },
        { styles: ['Tech House'] },
        { styles: ['Tech House', 'Electro House', 'Future House'] },
        { styles: ['Tech House'] },
      ],
      { topStyles: 3 },
    );

    expect(result.styles).toEqual(['Tech House', 'House', 'Progressive House']);
  });
});
