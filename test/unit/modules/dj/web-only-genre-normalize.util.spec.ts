import {
  isCatalogGenreToken,
  normalizeCatalogGenreToken,
  normalizeWebOnlyGenreToken,
  sanitizeCatalogGenreTokens,
} from '@src/modules/dj/web-only-genre-normalize.util';

describe('web-only-genre-normalize.util', () => {
  it('collapses Beatport mainstage marketing prose to Big Room', () => {
    expect(
      sanitizeCatalogGenreTokens([
        "mainstage electronic dance music ('explosive synths, driving energy, strong dancefloor impact')",
      ]),
    ).toEqual(['Big Room']);
  });

  it('keeps standard Discogs-style tokens unchanged', () => {
    expect(normalizeCatalogGenreToken('Tech House')).toBe('Tech House');
    expect(isCatalogGenreToken('Tech House')).toBe(true);
    expect(normalizeWebOnlyGenreToken('Progressive House')).toBe(
      'Progressive House',
    );
  });

  it('sanitizes comma-separated genre lists', () => {
    expect(sanitizeCatalogGenreTokens(['Techno', 'Minimal'])).toEqual([
      'Techno',
      'Minimal',
    ]);
  });

  it('extracts sub-genres from parenthetical Hermes prose', () => {
    expect(
      sanitizeCatalogGenreTokens([
        'Electronic (bass music · future bass · bass house · EDM)',
      ]),
    ).toEqual(['Bass', 'future bass', 'bass house', 'Big Room']);
  });

  it('rejects source and role metadata masquerading as genres', () => {
    expect(sanitizeCatalogGenreTokens(['Web'])).toEqual([]);
    expect(sanitizeCatalogGenreTokens(['DJ · producer'])).toEqual([]);
    expect(isCatalogGenreToken('Web')).toBe(false);
    expect(isCatalogGenreToken('DJ')).toBe(false);
  });

  it('keeps valid reggae and latin tokens', () => {
    expect(sanitizeCatalogGenreTokens(['Roots Reggae'])).toEqual([
      'Roots Reggae',
    ]);
    expect(
      sanitizeCatalogGenreTokens([
        'Latin Club',
        'techno',
        'merengue',
        'dembow',
      ]),
    ).toEqual(['Latin Club', 'techno', 'merengue', 'dembow']);
  });
});
