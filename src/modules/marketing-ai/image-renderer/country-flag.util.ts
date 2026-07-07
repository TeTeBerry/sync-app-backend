import { createRequire } from 'node:module';
import * as path from 'node:path';
import * as countries from 'i18n-iso-countries';

const packageRequire = createRequire(path.join(process.cwd(), 'package.json'));

const en = packageRequire('i18n-iso-countries/langs/en.json') as Parameters<
  typeof countries.registerLocale
>[0];
const zh = packageRequire('i18n-iso-countries/langs/zh.json') as Parameters<
  typeof countries.registerLocale
>[0];

countries.registerLocale(en);
countries.registerLocale(zh);

/** Common aliases not returned by i18n-iso-countries lookup. */
const COUNTRY_ALIASES: Record<string, string> = {
  USA: 'US',
  UK: 'GB',
  UAE: 'AE',
  Korea: 'KR',
  'South Korea': 'KR',
  'North Korea': 'KP',
  Russia: 'RU',
  Czechia: 'CZ',
  'Czech Republic': 'CZ',
  Taiwan: 'TW',
  'Hong Kong': 'HK',
  Macau: 'MO',
  Vietnam: 'VN',
  'Viet Nam': 'VN',
};

const REGIONAL_INDICATOR_BASE = 0x1f1e6;

export function isoToFlagEmoji(isoCode: string): string {
  const code = isoCode.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) {
    return '';
  }

  return [...code]
    .map((char) =>
      String.fromCodePoint(REGIONAL_INDICATOR_BASE + char.charCodeAt(0) - 65),
    )
    .join('');
}

function resolveCountryIsoCode(country: string): string | undefined {
  const trimmed = country.trim();
  if (!trimmed || trimmed.toLowerCase() === 'international') {
    return undefined;
  }

  const alias = COUNTRY_ALIASES[trimmed];
  if (alias) {
    return alias;
  }

  if (/^[a-zA-Z]{2}$/.test(trimmed)) {
    const upper = trimmed.toUpperCase();
    return countries.isValid(upper) ? upper : undefined;
  }

  const fromEn = countries.getAlpha2Code(trimmed, 'en');
  if (fromEn) {
    return fromEn;
  }

  const fromZh = countries.getAlpha2Code(trimmed, 'zh');
  if (fromZh) {
    return fromZh;
  }

  return undefined;
}

/** Resolve a country label to a Unicode flag emoji (e.g. Belgium → 🇧🇪). */
export function resolveCountryFlagEmoji(country?: string): string {
  if (!country?.trim()) {
    return '';
  }

  const iso = resolveCountryIsoCode(country);
  if (!iso) {
    return '';
  }

  return isoToFlagEmoji(iso);
}
