import {
  formatDiscogsStyleLabel,
  mergeDiscogsStyleLabels,
} from '@src/modules/dj/discogs-style-label.util';

describe('discogs-style-label.util', () => {
  it('prefers styles over genres', () => {
    expect(
      formatDiscogsStyleLabel({
        styles: ['Tech House', 'Deep House'],
        genres: ['Electronic'],
      }),
    ).toBe('Tech House · Deep House');
  });

  it('merges styles from multiple catalog items', () => {
    expect(
      mergeDiscogsStyleLabels([
        { styles: ['Drum n Bass', 'Jump Up'], genres: [] },
        { styles: ['Deep House', 'Drum n Bass'], genres: [] },
      ]),
    ).toBe('Drum n Bass · Jump Up · Deep House');
  });

  it('falls back to genres then placeholder', () => {
    expect(
      formatDiscogsStyleLabel({
        styles: [],
        genres: ['House'],
      }),
    ).toBe('House');
    expect(
      formatDiscogsStyleLabel({
        styles: [],
        genres: [],
      }),
    ).toBe('风格待补充');
  });
});
