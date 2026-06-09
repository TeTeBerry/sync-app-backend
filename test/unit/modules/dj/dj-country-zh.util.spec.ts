import {
  hasCjkText,
  translateCountryToZh,
} from '@src/modules/dj/dj-country-zh.util';

describe('dj-country-zh.util', () => {
  it('translates common English country names', () => {
    expect(translateCountryToZh('US')).toBe('美国');
    expect(translateCountryToZh('United Kingdom')).toBe('英国');
    expect(translateCountryToZh('Netherlands')).toBe('荷兰');
    expect(translateCountryToZh('Germany')).toBe('德国');
  });

  it('keeps Chinese country as-is', () => {
    expect(translateCountryToZh('美国')).toBe('美国');
  });

  it('detects CJK text', () => {
    expect(hasCjkText('伦敦 DJ')).toBe(true);
    expect(hasCjkText('London DJ')).toBe(false);
  });
});
