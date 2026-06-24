import {
  getChineseAliasesForArtistName,
  normalizeChineseAliasKey,
  resolveArtistSearchQuery,
  resolveCanonicalNameFromChineseAlias,
  chineseAliasMatchesQuery,
} from '@src/modules/dj/dj-chinese-aliases.util';

describe('dj-chinese-aliases.util', () => {
  it('resolves known Chinese nicknames to canonical artist names', () => {
    expect(resolveCanonicalNameFromChineseAlias('小马丁')).toBe(
      'Martin Garrix',
    );
    expect(resolveCanonicalNameFromChineseAlias(' 铁丝桶 ')).toBe('Tiësto');
    expect(resolveCanonicalNameFromChineseAlias('A神')).toBe('Avicii');
  });

  it('returns aliases for canonical artist names regardless of lineup casing', () => {
    expect(getChineseAliasesForArtistName('MARTIN GARRIX')).toEqual(['小马丁']);
    expect(getChineseAliasesForArtistName('dj snake')).toEqual([
      '蛇爷',
      '蛇叔',
    ]);
  });

  it('rewrites search queries when a nickname is recognized', () => {
    expect(resolveArtistSearchQuery('老棉')).toBe('Marshmello');
    expect(resolveArtistSearchQuery('Martin Garrix')).toBe('Martin Garrix');
  });

  it('matches partial Chinese alias queries', () => {
    expect(chineseAliasMatchesQuery(['铁丝桶', '老铁'], '铁丝')).toBe(true);
    expect(chineseAliasMatchesQuery(['小马丁'], '马丁')).toBe(true);
    expect(chineseAliasMatchesQuery(['小马丁'], '硬好')).toBe(false);
  });

  it('normalizes alias keys without stripping CJK characters', () => {
    expect(normalizeChineseAliasKey(' A神 ')).toBe('a神');
  });
});
