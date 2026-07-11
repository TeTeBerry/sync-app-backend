import {
  findActivityAirportProfile,
  resolveActivityPrimaryAirportCode,
} from '@src/data/travel-guide/travel-guide-activity-airports.data';
import { findHotActivityProfile } from '@src/data/travel-guide/travel-guide-hot-path.data';
import type { TravelGuideRegionKind } from './travel-guide-international.util';
import { resolveKnownDestinationCityCode } from './travel-guide-departure-airport.util';

export type RollingGoQuoteGeoInput = {
  activityLegacyId?: number;
  activityName?: string;
  activityCode?: string;
  activityArea?: string;
  location?: string;
  venueTitle?: string;
  venueAddress?: string;
  regionKind: TravelGuideRegionKind;
};

export type RollingGoQuoteGeoContext = {
  destinationCity: string;
  corpus: string;
  hotelCountryCode?: string;
  hotelPlace: string;
  /** 海外按会场 POI 搜酒店时为「景点」，否则为「城市」 */
  hotelSearchPlaceType: '城市' | '景点';
  /** hot-path 会场坐标，用于酒店距会场直线距离 */
  venueCoords?: { lat: number; lng: number };
  airportKeywords: string[];
  destinationCityCode?: string;
};

const OVERSEAS_AREA_QUOTE: Record<
  string,
  { countryCode: string; airportKeywords: string[] }
> = {
  泰国: {
    countryCode: 'TH',
    airportKeywords: ['曼谷', '普吉', 'Bangkok', 'Phuket'],
  },
  韩国: {
    countryCode: 'KR',
    airportKeywords: ['首尔', '仁川', 'Incheon', 'Seoul'],
  },
  日本: {
    countryCode: 'JP',
    airportKeywords: ['东京', '大阪', 'Tokyo', 'Osaka'],
  },
  荷兰: { countryCode: 'NL', airportKeywords: ['阿姆斯特丹', 'Amsterdam'] },
  比利时: { countryCode: 'BE', airportKeywords: ['布鲁塞尔', 'Brussels'] },
  英国: { countryCode: 'GB', airportKeywords: ['伦敦', 'London'] },
  阿联酋: { countryCode: 'AE', airportKeywords: ['迪拜', 'Dubai'] },
  美国: {
    countryCode: 'US',
    airportKeywords: ['洛杉矶', '纽约', 'Las Vegas', 'Orlando'],
  },
  沙特: {
    countryCode: 'SA',
    airportKeywords: ['利雅得', '吉达', 'Riyadh', 'Jeddah'],
  },
  罗马尼亚: { countryCode: 'RO', airportKeywords: ['布加勒斯特', 'Bucharest'] },
  克罗地亚: {
    countryCode: 'HR',
    airportKeywords: ['萨格勒布', 'Zagreb', '斯普利特', 'Split'],
  },
  香港: { countryCode: 'HK', airportKeywords: ['香港', 'Hong Kong'] },
  澳门: { countryCode: 'MO', airportKeywords: ['澳门', 'Macau'] },
  台湾: { countryCode: 'TW', airportKeywords: ['台北', 'Taipei', '高雄'] },
};

const COUNTRY_PREFIX =
  /^(中国|韩国|日本|泰国|荷兰|比利时|英国|阿联酋|美国|沙特|罗马尼亚|克罗地亚|香港|澳门|台湾)$/;

const KNOWN_CITY_TOKENS = [
  '芭提雅',
  '曼谷',
  '普吉',
  '清迈',
  '仁川',
  '首尔',
  '釜山',
  '东京',
  '大阪',
  '冲绳',
  '迪拜',
  '伦敦',
  '阿姆斯特丹',
  '布鲁塞尔',
];

export function normalizeQuoteDestinationCity(
  location?: string,
  activityArea?: string,
): string {
  const loc = location?.trim() ?? '';
  if (!loc) return activityArea?.trim() ?? '';

  if (loc.includes('·') || loc.includes('，') || loc.includes(',')) {
    const parts = loc
      .split(/[·,，]/)
      .map((part) => part.trim())
      .filter(Boolean);
    const head = parts[0] ?? loc;
    if (parts.length >= 2 && COUNTRY_PREFIX.test(head)) {
      return extractCityToken(parts[1]!);
    }
    return extractCityToken(head);
  }

  return extractCityToken(loc);
}

function extractCityToken(segment: string): string {
  const trimmed = segment.trim();
  for (const city of KNOWN_CITY_TOKENS) {
    if (trimmed.startsWith(city)) return city;
  }
  const zhLead = trimmed.match(/^([\u4e00-\u9fa5]{2,4})/)?.[1];
  if (zhLead) return zhLead;
  return trimmed.split(/\s+/)[0]?.trim() || trimmed;
}

function uniqueKeywords(keywords: Array<string | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const keyword of keywords) {
    const value = keyword?.trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

const PREFERRED_GATEWAY_IATA = new Set([
  'BKK',
  'ICN',
  'NRT',
  'HND',
  'HKG',
  'TPE',
  'DXB',
  'LHR',
  'AMS',
  'BRU',
  'LAX',
  'LAS',
  'MCO',
  'HKT',
  'CNX',
]);

export function resolveHotPathPrimaryAirportCode(
  activityLegacyId?: number,
): string | undefined {
  if (!activityLegacyId) return undefined;
  const profile = findHotActivityProfile(activityLegacyId);
  if (!profile?.hubRoutes.length) return undefined;

  const airportHubs = profile.hubRoutes.filter((hub) =>
    /airport|机场/i.test(`${hub.hubKey}${hub.hubLabel}`),
  );
  if (!airportHubs.length) return undefined;

  for (const hub of airportHubs) {
    for (const alias of hub.departureAliases ?? []) {
      const iata = alias.match(/\b([A-Z]{3})\b/)?.[1];
      if (iata && PREFERRED_GATEWAY_IATA.has(iata)) return iata;
    }
  }

  for (const hub of airportHubs) {
    for (const alias of hub.departureAliases ?? []) {
      const iata = alias.match(/\b([A-Z]{3})\b/)?.[1];
      if (iata) return iata;
    }
  }
  return undefined;
}

export function buildRollingGoQuoteGeoContext(
  input: RollingGoQuoteGeoInput,
): RollingGoQuoteGeoContext {
  const destinationCity = normalizeQuoteDestinationCity(
    input.location,
    input.activityArea,
  );
  const corpus = [
    input.activityName,
    input.activityArea,
    input.location,
    destinationCity,
    input.venueTitle,
    input.venueAddress,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const areaDefaults = input.activityArea
    ? OVERSEAS_AREA_QUOTE[input.activityArea.trim()]
    : undefined;
  const activityAirport = findActivityAirportProfile(input.activityLegacyId);

  // Prefer activity fly-in airport keywords first so country hubs (e.g. LAX for
  // all US festivals) never win MCP fallback ahead of Columbus / Manchester / Cluj.
  const airportKeywords = uniqueKeywords([
    ...(activityAirport?.airportKeywords ?? []),
    destinationCity,
    ...corpusAirportKeywordsFromText(corpus),
    ...(areaDefaults?.airportKeywords ?? []),
    input.activityArea,
  ]);

  const profile = input.activityLegacyId
    ? findHotActivityProfile(input.activityLegacyId)
    : undefined;
  const venueSearchName =
    input.venueTitle?.trim() || profile?.venue.title || '';
  const overseasVenueHotelSearch =
    input.regionKind === 'overseas' && Boolean(venueSearchName);
  const venueCoords = profile?.venue
    ? { lat: profile.venue.lat, lng: profile.venue.lng }
    : undefined;

  return {
    destinationCity,
    corpus,
    hotelCountryCode:
      areaDefaults?.countryCode ?? countryCodeFromCorpus(corpus),
    hotelPlace: overseasVenueHotelSearch
      ? venueSearchName
      : destinationCity ||
        input.activityArea?.trim() ||
        input.location?.trim() ||
        '',
    hotelSearchPlaceType: overseasVenueHotelSearch
      ? '景点'
      : input.regionKind === 'overseas'
        ? '城市'
        : '景点',
    ...(venueCoords ? { venueCoords } : {}),
    airportKeywords,
    destinationCityCode: resolveDestinationAirportCode(
      input.regionKind,
      input.activityLegacyId,
      destinationCity,
    ),
  };
}

/**
 * Resolve RollingGo destination airport IATA (`toAirport`): activity common
 * airport → hot-path hub → domestic/hmt known airport map.
 */
function resolveDestinationAirportCode(
  regionKind: TravelGuideRegionKind,
  activityLegacyId: number | undefined,
  destinationCity: string,
): string | undefined {
  return (
    resolveActivityPrimaryAirportCode(activityLegacyId) ??
    resolveHotPathPrimaryAirportCode(activityLegacyId) ??
    (regionKind === 'domestic' || regionKind === 'hmt'
      ? resolveKnownDestinationCityCode(destinationCity)
      : undefined)
  );
}

function corpusAirportKeywordsFromText(corpus: string): string[] {
  const keywords: string[] = [];
  if (/普吉|phuket|patong/.test(corpus)) keywords.push('普吉', 'Phuket');
  if (/清迈|chiang\s*mai/.test(corpus)) keywords.push('清迈');
  if (/苏梅|samui/.test(corpus)) keywords.push('苏梅岛');
  if (/芭提雅|pattaya|曼谷|bangkok|泰国|thailand/.test(corpus)) {
    keywords.push('曼谷', 'Bangkok', '芭提雅', 'Pattaya');
  }
  if (/韩国|korea|首尔|seoul|仁川|incheon|釜山|busan/.test(corpus)) {
    keywords.push('仁川', 'Incheon', '首尔', 'Seoul');
  }
  if (
    /日本|japan|东京|tokyo|大阪|osaka|冲绳|okinawa|北海道|sapporo/.test(corpus)
  ) {
    keywords.push('东京', 'Tokyo', '大阪', 'Osaka');
  }
  if (/迪拜|dubai|阿联酋|uae/.test(corpus)) keywords.push('迪拜', 'Dubai');
  if (/伦敦|london|英国|uk/.test(corpus)) keywords.push('伦敦', 'London');
  if (/阿姆斯特丹|amsterdam|荷兰|netherlands/.test(corpus)) {
    keywords.push('阿姆斯特丹', 'Amsterdam');
  }
  if (/布鲁塞尔|brussels|比利时|belgium|tomorrowland/.test(corpus)) {
    keywords.push('布鲁塞尔', 'Brussels');
  }
  if (/奥兰多|orlando|edc orlando/.test(corpus))
    keywords.push('奥兰多', 'Orlando');
  if (/拉斯维加斯|las vegas|edc las/.test(corpus)) {
    keywords.push('拉斯维加斯', 'Las Vegas');
  }
  if (
    /俄亥俄|ohio|columbus|thornville|legend\s*valley|lost\s*lands/.test(corpus)
  ) {
    keywords.push('哥伦布', 'Columbus', 'CMH');
  }
  if (/克卢日|cluj|untold/.test(corpus) && /罗马尼亚|romania/.test(corpus)) {
    keywords.push('克卢日', 'Cluj', 'CLJ');
  }
  if (
    /沃灵顿|warrington|daresbury|creamfields|曼彻斯特|manchester/.test(corpus)
  ) {
    keywords.push('曼彻斯特', 'Manchester', 'MAN');
  }
  if (/香港|hong\s*kong/.test(corpus)) keywords.push('香港');
  if (/澳门|macau/.test(corpus)) keywords.push('澳门');
  if (/台北|taipei|台湾|taiwan/.test(corpus)) keywords.push('台北', 'Taipei');
  return keywords;
}

function countryCodeFromCorpus(corpus: string): string | undefined {
  if (/泰国|thailand|曼谷|bangkok|芭提雅|pattaya|普吉|phuket/.test(corpus))
    return 'TH';
  if (/韩国|korea|首尔|seoul|仁川|incheon|釜山|busan/.test(corpus)) return 'KR';
  if (/日本|japan|东京|tokyo|大阪|osaka|冲绳|okinawa/.test(corpus)) return 'JP';
  if (/香港|hong\s*kong/.test(corpus)) return 'HK';
  if (/澳门|macau/.test(corpus)) return 'MO';
  if (/台湾|taipei|台北|高雄/.test(corpus)) return 'TW';
  if (/阿联酋|uae|迪拜|dubai/.test(corpus)) return 'AE';
  if (/英国|uk|伦敦|london/.test(corpus)) return 'GB';
  if (/荷兰|netherlands|阿姆斯特丹|amsterdam/.test(corpus)) return 'NL';
  if (/比利时|belgium|布鲁塞尔|brussels/.test(corpus)) return 'BE';
  if (/美国|usa|las vegas|orlando|纽约|洛杉矶/.test(corpus)) return 'US';
  if (/沙特|saudi|利雅得|吉达/.test(corpus)) return 'SA';
  if (/罗马尼亚|romania|bucharest/.test(corpus)) return 'RO';
  if (/克罗地亚|croatia|split|zagreb/.test(corpus)) return 'HR';
  return undefined;
}
