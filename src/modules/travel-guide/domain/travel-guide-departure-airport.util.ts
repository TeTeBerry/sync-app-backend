import {
  findDepartureCityAnchor,
  normalizeDepartureCityLabel,
} from '../map/travel-guide-departure-suggestions.util';
import type { TravelGuideRegionKind } from './travel-guide-international.util';

type AirportInfo = { name: string; iata: string };

/** 国内主要出发城市 → 常用国际机场（国际段默认从机场出发，不走高铁枢纽）。 */
const DEPARTURE_AIRPORTS: Record<string, AirportInfo> = {
  上海: { name: '上海浦东/虹桥国际机场', iata: 'PVG/SHA' },
  北京: { name: '北京首都/大兴国际机场', iata: 'PEK/PKX' },
  广州: { name: '广州白云国际机场', iata: 'CAN' },
  深圳: { name: '深圳宝安国际机场', iata: 'SZX' },
  杭州: { name: '杭州萧山国际机场', iata: 'HGH' },
  南京: { name: '南京禄口国际机场', iata: 'NKG' },
  成都: { name: '成都天府/双流国际机场', iata: 'TFU/CTU' },
  武汉: { name: '武汉天河国际机场', iata: 'WUH' },
  重庆: { name: '重庆江北国际机场', iata: 'CKG' },
  西安: { name: '西安咸阳国际机场', iata: 'XIY' },
  苏州: { name: '上海虹桥/浦东国际机场', iata: 'SHA/PVG' },
  天津: { name: '天津滨海国际机场', iata: 'TSN' },
  青岛: { name: '青岛胶东国际机场', iata: 'TAO' },
  厦门: { name: '厦门高崎国际机场', iata: 'XMN' },
  长沙: { name: '长沙黄花国际机场', iata: 'CSX' },
  郑州: { name: '郑州新郑国际机场', iata: 'CGO' },
  珠海: { name: '珠海金湾/广州白云国际机场', iata: 'ZUH/CAN' },
  东莞: { name: '深圳宝安/广州白云国际机场', iata: 'SZX/CAN' },
  佛山: { name: '广州白云国际机场', iata: 'CAN' },
  宁波: { name: '宁波栎社国际机场', iata: 'NGB' },
  无锡: { name: '无锡硕放/上海虹桥国际机场', iata: 'WUX/SHA' },
  合肥: { name: '合肥新桥国际机场', iata: 'HFE' },
  昆明: { name: '昆明长水国际机场', iata: 'KMG' },
  南宁: { name: '南宁吴圩国际机场', iata: 'NNG' },
  大连: { name: '大连周水子国际机场', iata: 'DLC' },
  沈阳: { name: '沈阳桃仙国际机场', iata: 'SHE' },
  哈尔滨: { name: '哈尔滨太平国际机场', iata: 'HRB' },
  济南: { name: '济南遥墙国际机场', iata: 'TNA' },
  福州: { name: '福州长乐国际机场', iata: 'FOC' },
  南昌: { name: '南昌昌北国际机场', iata: 'KHN' },
  贵阳: { name: '贵阳龙洞堡国际机场', iata: 'KWE' },
  海口: { name: '海口美兰国际机场', iata: 'HAK' },
  三亚: { name: '三亚凤凰国际机场', iata: 'SYX' },
  兰州: { name: '兰州中川国际机场', iata: 'LHW' },
  乌鲁木齐: { name: '乌鲁木齐天山国际机场', iata: 'URC' },
  呼和浩特: { name: '呼和浩特白塔国际机场', iata: 'HET' },
  石家庄: { name: '石家庄正定国际机场', iata: 'SJW' },
  太原: { name: '太原武宿国际机场', iata: 'TYN' },
  常州: { name: '常州奔牛/上海虹桥国际机场', iata: 'CZX/SHA' },
  温州: { name: '温州龙湾国际机场', iata: 'WNZ' },
  绍兴: { name: '杭州萧山国际机场', iata: 'HGH' },
  惠州: { name: '深圳宝安国际机场', iata: 'SZX' },
  中山: { name: '广州白云/深圳宝安国际机场', iata: 'CAN/SZX' },
  香港: { name: '香港国际机场', iata: 'HKG' },
  澳门: { name: '澳门国际机场', iata: 'MFM' },
  首尔: { name: '仁川/金浦国际机场', iata: 'ICN/GMP' },
  东京: { name: '羽田/成田国际机场', iata: 'HND/NRT' },
  曼谷: { name: '曼谷素万那普/廊曼国际机场', iata: 'BKK/DMK' },
  普吉: { name: '普吉国际机场', iata: 'HKT' },
  大阪: { name: '关西/伊丹国际机场', iata: 'KIX/ITM' },
  迪拜: { name: '迪拜国际机场', iata: 'DXB' },
  新加坡: { name: '新加坡樟宜国际机场', iata: 'SIN' },
  伦敦: { name: '伦敦希思罗/盖特威克机场', iata: 'LHR/LGW' },
  纽约: { name: '纽约肯尼迪/纽瓦克国际机场', iata: 'JFK/EWR' },
  洛杉矶: { name: '洛杉矶国际机场', iata: 'LAX' },
};

/**
 * EN / alternate labels → canonical DEPARTURE_AIRPORTS key.
 * Raven EN presets use English city names (Singapore, London, …).
 */
const DEPARTURE_CITY_ALIASES: Record<string, string> = {
  singapore: '新加坡',
  shanghai: '上海',
  beijing: '北京',
  guangzhou: '广州',
  shenzhen: '深圳',
  hangzhou: '杭州',
  chengdu: '成都',
  'hong kong': '香港',
  hongkong: '香港',
  macau: '澳门',
  macao: '澳门',
  seoul: '首尔',
  incheon: '首尔',
  tokyo: '东京',
  bangkok: '曼谷',
  phuket: '普吉',
  osaka: '大阪',
  dubai: '迪拜',
  london: '伦敦',
  'new york': '纽约',
  newyork: '纽约',
  nyc: '纽约',
  'los angeles': '洛杉矶',
  losangeles: '洛杉矶',
};

/** Normalize departure/destination city label for airport IATA lookup. */
export function canonicalizeDepartureCityForAirport(cityLabel: string): string {
  const trimmed = cityLabel.trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  const aliased = DEPARTURE_CITY_ALIASES[lower];
  if (aliased) return aliased;

  if (DEPARTURE_AIRPORTS[trimmed]) return trimmed;

  const caseHit = Object.keys(DEPARTURE_AIRPORTS).find(
    (key) => key.toLowerCase() === lower,
  );
  return caseHit ?? trimmed;
}

function primaryIataCode(iata: string): string | undefined {
  const primary = iata.split('/')[0]?.trim().toUpperCase();
  return primary?.length === 3 ? primary : undefined;
}

/** 已知出发城市 → RollingGo 航班 searchFlights 机场码（优先于 MCP 机场搜索）。 */
export function resolveKnownDepartureCityCode(
  cityLabel: string,
): string | undefined {
  const city = canonicalizeDepartureCityForAirport(cityLabel);
  const airport = DEPARTURE_AIRPORTS[city];
  if (!airport) return undefined;
  return primaryIataCode(airport.iata);
}

/**
 * Known departure cities map to airport IATA — use RollingGo `fromAirport`
 * (not `fromCity`) per official contract.
 */
export function resolveKnownDepartureAirportCode(
  cityLabel: string,
): string | undefined {
  return resolveKnownDepartureCityCode(cityLabel);
}

/**
 * Secondary departure airport IATAs (slash-separated after primary) to probe
 * when the primary returns no flight offers (e.g. LGW after LHR, EWR after JFK).
 */
export function resolveKnownDepartureAlternateAirportCodes(
  cityLabel: string,
): string[] {
  const city = canonicalizeDepartureCityForAirport(cityLabel);
  const airport = DEPARTURE_AIRPORTS[city];
  if (!airport?.iata) return [];
  const parts = airport.iata
    .split('/')
    .map((part) => part.trim().toUpperCase())
    .filter((code) => code.length === 3);
  const primary = parts[0];
  if (!primary) return [];
  const seen = new Set<string>([primary]);
  const out: string[] = [];
  for (const code of parts.slice(1)) {
    if (seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

/** 国内/港澳台目的地城市 → IATA（与出发城市共用映射，支持 RollingGo 国内线）。 */
export function resolveKnownDestinationCityCode(
  cityLabel: string,
): string | undefined {
  return resolveKnownDepartureCityCode(cityLabel);
}

/**
 * English-first keywords for RollingGo searchAirports (official CLI prefers EN).
 */
export function rollingGoAirportSearchKeywords(cityLabel: string): string[] {
  const city = canonicalizeDepartureCityForAirport(cityLabel);
  if (!city) return [];
  const mapped = DEPARTURE_AIRPORT_SEARCH_KEYWORDS[city];
  if (mapped?.length) return [...mapped];
  const raw = cityLabel.trim();
  // Latin / IATA already — keep as-is; otherwise try raw Chinese as last resort.
  if (/^[A-Za-z0-9\s\-']+$/.test(raw)) return [raw];
  return [raw || city];
}

const DEPARTURE_AIRPORT_SEARCH_KEYWORDS: Record<string, string[]> = {
  上海: ['Shanghai', 'PVG', 'SHA'],
  北京: ['Beijing', 'PEK', 'PKX'],
  广州: ['Guangzhou', 'CAN'],
  深圳: ['Shenzhen', 'SZX'],
  杭州: ['Hangzhou', 'HGH'],
  成都: ['Chengdu', 'TFU', 'CTU'],
  香港: ['Hong Kong', 'HKG'],
  澳门: ['Macau', 'MFM'],
  首尔: ['Seoul', 'Incheon', 'ICN'],
  东京: ['Tokyo', 'HND', 'NRT'],
  曼谷: ['Bangkok', 'BKK', 'DMK'],
  普吉: ['Phuket', 'HKT'],
  大阪: ['Osaka', 'KIX'],
  迪拜: ['Dubai', 'DXB'],
  新加坡: ['Singapore', 'SIN', 'Changi'],
  伦敦: ['London', 'LHR', 'LGW', 'Heathrow'],
  纽约: ['New York', 'JFK', 'EWR', 'NYC'],
  洛杉矶: ['Los Angeles', 'LAX'],
  珠海: ['Zhuhai', 'ZUH'],
  南京: ['Nanjing', 'NKG'],
  武汉: ['Wuhan', 'WUH'],
  重庆: ['Chongqing', 'CKG'],
  西安: ['Xian', 'XIY'],
  厦门: ['Xiamen', 'XMN'],
  昆明: ['Kunming', 'KMG'],
};

/** 任意中国城市名 → RollingGo 航班三字码（出发/到达通用）。 */
export function resolveKnownCityAirportCode(
  cityLabel: string,
): string | undefined {
  return resolveKnownDepartureCityCode(cityLabel);
}

/**
 * 境外/特殊目的地 → RollingGo searchAirports 关键词。
 * 芭提雅等无独立国际机场的城市，映射到主要门户机场（如曼谷）。
 */
export function resolveFlightDestinationAirportKeyword(input: {
  destinationCity: string;
  venueTitle?: string;
  venueAddress?: string;
}): string {
  const corpus =
    `${input.destinationCity} ${input.venueTitle ?? ''} ${input.venueAddress ?? ''}`.toLowerCase();

  if (/普吉|phuket|patong/.test(corpus)) return '普吉';
  if (/清迈|chiang\s*mai/.test(corpus)) return '清迈';
  if (/苏梅|samui|koh\s*samui/.test(corpus)) return '苏梅岛';
  if (/芭提雅|pattaya|曼谷|bangkok|泰国|thailand/.test(corpus)) return '曼谷';

  if (/韩国|korea|首尔|seoul|仁川|incheon|釜山|busan/.test(corpus)) {
    return /釜山|busan/.test(corpus) ? '釜山' : '首尔';
  }
  if (
    /日本|japan|东京|tokyo|大阪|osaka|北海道|sapporo|札幌|冲绳|okinawa|那霸|naha/.test(
      corpus,
    )
  ) {
    if (/大阪|osaka/.test(corpus)) return '大阪';
    if (/北海道|sapporo|札幌/.test(corpus)) return '札幌';
    if (/冲绳|okinawa|那霸|naha/.test(corpus)) return '冲绳';
    return '东京';
  }

  if (/香港|hong\s*kong/.test(corpus)) return '香港';
  if (/澳门|macau/.test(corpus)) return '澳门';
  if (/台北|taoyuan|高雄|台湾|taipei/.test(corpus)) return '台北';

  const head = input.destinationCity.split(/\s+/)[0]?.trim();
  return head || input.destinationCity.trim();
}

export function resolveRollingGoHotelCountryCode(input: {
  destinationCity: string;
  venueTitle?: string;
  venueAddress?: string;
}): string | undefined {
  const corpus =
    `${input.destinationCity} ${input.venueTitle ?? ''} ${input.venueAddress ?? ''}`.toLowerCase();

  if (
    /泰国|thailand|曼谷|bangkok|芭提雅|pattaya|普吉|phuket|清迈|chiang|苏梅|samui/.test(
      corpus,
    )
  ) {
    return 'TH';
  }
  if (/韩国|korea|首尔|seoul|仁川|incheon|釜山|busan/.test(corpus)) return 'KR';
  if (
    /日本|japan|东京|tokyo|大阪|osaka|冲绳|okinawa|北海道|sapporo/.test(corpus)
  ) {
    return 'JP';
  }
  if (/香港|hong\s*kong/.test(corpus)) return 'HK';
  if (/澳门|macau/.test(corpus)) return 'MO';
  if (/台湾|taipei|台北|高雄|kaohsiung/.test(corpus)) return 'TW';
  return undefined;
}

export function resolveRollingGoHotelPlace(input: {
  destinationCity: string;
}): string {
  return (
    input.destinationCity.split(/\s+/)[0]?.trim() ||
    input.destinationCity.trim()
  );
}

export function resolveDepartureCityLabel(
  departureText: string,
  departureCity?: string,
): string {
  const fromText = findDepartureCityAnchor(departureText.trim());
  if (fromText) return fromText;
  const picked = departureCity?.trim();
  if (picked) return normalizeDepartureCityLabel(picked);
  const head = departureText
    .trim()
    .split(/[·,，/\s]/)[0]
    ?.trim();
  return head ? normalizeDepartureCityLabel(head) : departureText.trim();
}

export function resolveDepartureAirportLabel(
  departureText: string,
  departureCity?: string,
  locale?: 'zh' | 'en',
): string {
  const city = canonicalizeDepartureCityForAirport(
    resolveDepartureCityLabel(departureText, departureCity),
  );
  const airport = city ? DEPARTURE_AIRPORTS[city] : undefined;
  if (airport) {
    if (locale === 'en') {
      return `${englishAirportName(airport.name)} (${airport.iata})`;
    }
    return `${airport.name}（${airport.iata}）`;
  }
  const label = departureText.trim() || city || '出发地';
  if (locale === 'en') return `${label} international airport`;
  return `${label}就近主要国际机场`;
}

export function resolveDestinationAirportLabel(
  profile: {
    destinationCity: string;
    thailand: boolean;
    bangkok: boolean;
    regionKind: TravelGuideRegionKind;
  },
  activityLocation?: string,
  locale?: 'zh' | 'en',
): string {
  const corpus =
    `${activityLocation ?? ''} ${profile.destinationCity}`.toLowerCase();

  if (profile.thailand) {
    if (/普吉|phuket|patong/.test(corpus)) {
      return locale === 'en'
        ? 'Phuket International Airport (HKT)'
        : '普吉国际机场（HKT）';
    }
    if (profile.bangkok) {
      return locale === 'en'
        ? 'Bangkok Suvarnabhumi / Don Mueang Airports (BKK/DMK)'
        : '曼谷素万那普/廊曼机场（BKK/DMK）';
    }
    return locale === 'en'
      ? 'Bangkok / Phuket major airports'
      : '曼谷/普吉等主要机场';
  }

  if (/韩国|korea|仁川|incheon|首尔|seoul|永宗|yeongjong/.test(corpus)) {
    return locale === 'en'
      ? 'Incheon International Airport (ICN)'
      : '仁川国际机场（ICN）';
  }

  if (
    /日本|japan|东京|tokyo|台场|odaiba|海の森|羽田|haneda|成田|narita/.test(
      corpus,
    )
  ) {
    return locale === 'en'
      ? 'Haneda / Narita International Airports (HND/NRT)'
      : '羽田/成田国际机场（HND/NRT）';
  }

  if (profile.regionKind === 'hmt') {
    if (/香港|hong\s*kong/.test(corpus))
      return locale === 'en'
        ? 'Hong Kong International Airport (HKG)'
        : '香港国际机场（HKG）';
    if (/澳门|macau/.test(corpus))
      return locale === 'en'
        ? 'Macau International Airport (MFM)'
        : '澳门国际机场（MFM）';
    if (/台湾|台北|高雄|taoyuan/.test(corpus)) {
      return locale === 'en'
        ? 'Taiwan Taoyuan / Kaohsiung Airports (TPE/KHH)'
        : '台湾桃园/高雄等机场（TPE/KHH）';
    }
  }

  return locale === 'en'
    ? `${profile.destinationCity} major international airport`
    : `${profile.destinationCity}主要国际机场`;
}

function englishAirportName(name: string): string {
  return name
    .replace(
      /上海浦东\/虹桥国际机场/g,
      'Shanghai Pudong / Hongqiao International Airports',
    )
    .replace(
      /上海虹桥\/浦东国际机场/g,
      'Shanghai Hongqiao / Pudong International Airports',
    )
    .replace(/普吉国际机场/g, 'Phuket International Airport')
    .replace(
      /曼谷素万那普\/廊曼国际机场/g,
      'Bangkok Suvarnabhumi / Don Mueang International Airports',
    )
    .replace(/仁川\/金浦国际机场/g, 'Incheon / Gimpo International Airports')
    .replace(/羽田\/成田国际机场/g, 'Haneda / Narita International Airports');
}

/** 过滤国内高铁/火车站枢纽提示，避免污染国际段攻略。 */
export function filterDomesticTransportHints(hints: string[]): string[] {
  const domesticPattern =
    /高铁|动车|12306|北站|南站|东站|西站|福田站|广州南|虹桥|枢纽|抵深|广深|地铁11|火车站|城际轨|Railway/i;
  return hints.filter((hint) => !domesticPattern.test(hint));
}
