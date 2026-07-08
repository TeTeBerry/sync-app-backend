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
    expect(expandFestivalArtistName('BLOCK & CROWN')).toEqual([
      'BLOCK & CROWN',
    ]);
    expect(expandFestivalArtistName('MIKE & ME')).toEqual(['MIKE & ME']);
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

  it('matches Creamfields billing aliases to catalog names', () => {
    const catalog = [
      { name: 'AMELIE LENS', discogsId: 5119514 },
      { name: 'ANDY C', discogsId: 337 },
      { name: 'LAU.RA', discogsId: 7383729 },
      { name: 'Cloudy', discogsId: 997451616 },
    ];

    expect(
      matchLineupArtistToCatalog('Amelie Lens Presents AURA', catalog)?.name,
    ).toBe('AMELIE LENS');
    expect(
      matchLineupArtistToCatalog('Andy C ft Tonn Piper', catalog)?.name,
    ).toBe('ANDY C');
    expect(matchLineupArtistToCatalog('Lau', catalog)?.name).toBe('LAU.RA');
    expect(matchLineupArtistToCatalog('Cloudy', catalog)?.name).toBe('Cloudy');
  });

  it('expands ft and presents billing into primary artist', () => {
    expect(expandFestivalArtistName('Andy C ft Tonn Piper')).toEqual([
      'Andy C',
    ]);
    expect(expandFestivalArtistName('Amelie Lens Presents AURA')).toEqual([
      'Amelie Lens',
    ]);
  });
});
