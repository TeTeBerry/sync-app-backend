import {
  isoToFlagEmoji,
  resolveCountryFlagEmoji,
} from '../../../../src/modules/marketing-ai/image-renderer/country-flag.util';

describe('country-flag.util', () => {
  it('converts ISO alpha-2 codes to flag emoji', () => {
    expect(isoToFlagEmoji('BE')).toBe('🇧🇪');
    expect(isoToFlagEmoji('TH')).toBe('🇹🇭');
    expect(isoToFlagEmoji('us')).toBe('🇺🇸');
  });

  it('resolves English country names', () => {
    expect(resolveCountryFlagEmoji('Belgium')).toBe('🇧🇪');
    expect(resolveCountryFlagEmoji('Thailand')).toBe('🇹🇭');
    expect(resolveCountryFlagEmoji('United States')).toBe('🇺🇸');
    expect(resolveCountryFlagEmoji('Netherlands')).toBe('🇳🇱');
    expect(resolveCountryFlagEmoji('Croatia')).toBe('🇭🇷');
  });

  it('resolves common aliases', () => {
    expect(resolveCountryFlagEmoji('USA')).toBe('🇺🇸');
    expect(resolveCountryFlagEmoji('UK')).toBe('🇬🇧');
    expect(resolveCountryFlagEmoji('UAE')).toBe('🇦🇪');
    expect(resolveCountryFlagEmoji('Korea')).toBe('🇰🇷');
  });

  it('resolves Chinese country names', () => {
    expect(resolveCountryFlagEmoji('比利时')).toBe('🇧🇪');
    expect(resolveCountryFlagEmoji('泰国')).toBe('🇹🇭');
    expect(resolveCountryFlagEmoji('日本')).toBe('🇯🇵');
  });

  it('returns empty for unknown or non-country labels', () => {
    expect(resolveCountryFlagEmoji('International')).toBe('');
    expect(resolveCountryFlagEmoji('')).toBe('');
    expect(resolveCountryFlagEmoji(undefined)).toBe('');
    expect(resolveCountryFlagEmoji('Atlantis')).toBe('');
  });
});
