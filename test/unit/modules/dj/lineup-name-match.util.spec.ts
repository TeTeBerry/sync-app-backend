import {
  expandFestivalArtistName,
  matchLineupArtistToCatalog,
} from '@src/modules/dj/lineup-name-match.util';

describe('lineup-name-match.util', () => {
  const catalog = [
    { name: 'Green Velvet' },
    { name: 'Wukong' },
    { name: 'Taiki & Nulight' },
    { name: 'Subtronics' },
  ];

  it('expands B2B lineup names into solo artists', () => {
    expect(expandFestivalArtistName('KANINE B2B SOTA')).toEqual([
      'KANINE',
      'SOTA',
    ]);
  });

  it('expands split-able & lineup names into solo artists', () => {
    expect(expandFestivalArtistName('JOHN MASAKI & KIM SANE')).toEqual([
      'JOHN MASAKI',
      'KIM SANE',
    ]);
    expect(expandFestivalArtistName('ABOVE & BEYOND')).toEqual([
      'ABOVE & BEYOND',
    ]);
  });

  it('matches B2B split lineup names', () => {
    expect(matchLineupArtistToCatalog('GREEN VELVET', catalog)?.name).toBe(
      'Green Velvet',
    );
  });

  it('matches alias lineup names', () => {
    expect(matchLineupArtistToCatalog('WUJACKERS', catalog)?.name).toBe(
      'Wukong',
    );
    expect(matchLineupArtistToCatalog('LEVELTRONICS', catalog)?.name).toBe(
      'Subtronics',
    );
  });

  it('prefers explicit alias over partial name collisions', () => {
    const crowded = [
      { name: 'Ghengar' },
      { name: 'Ghastly' },
      { name: 'Wukong' },
    ];
    expect(matchLineupArtistToCatalog('GHENGAR (GHASTLY)', crowded)?.name).toBe(
      'Ghengar',
    );
  });

  it('matches GHENGAR via Ghastly when Ghengar is absent from catalog', () => {
    const ghastlyOnly = [{ name: 'Ghastly', discogsId: 123 }];
    expect(matchLineupArtistToCatalog('GHENGAR', ghastlyOnly)?.name).toBe(
      'Ghastly',
    );
    expect(
      matchLineupArtistToCatalog('GHENGAR (GHASTLY)', ghastlyOnly)?.name,
    ).toBe('Ghastly');
  });

  it('matches exact lineup name and ignores partial homonyms', () => {
    const crowded = [
      { name: 'Marsha Smith', discogsId: 1 },
      { name: 'Marshmello', discogsId: 2 },
    ];
    expect(matchLineupArtistToCatalog('MARSHMELLO', crowded)?.name).toBe(
      'Marshmello',
    );
  });

  it('does not fuzzy-match partial catalog names', () => {
    const crowded = [{ name: 'Marsha Smith', discogsId: 1 }];
    expect(matchLineupArtistToCatalog('MARTIN GARRIX', crowded)).toBeNull();
  });
});
