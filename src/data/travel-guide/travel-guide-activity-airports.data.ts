/**
 * Per-activity primary fly-in airport for RollingGo flight quotes.
 * Prefer the realistic festival gateway (nearest major commercial airport
 * attendees actually use), not country-level hubs (e.g. LAX for all US).
 *
 * `primaryIata` / `alternateIatas` are airport IATA codes for RollingGo
 * `toAirport` (not `toCity`) per official searchFlights contract.
 *
 * Keep in sync with `scripts/lib/activity-catalog-seed-data.mjs` legacyIds.
 */
export type ActivityAirportProfile = {
  /** Primary airport IATA → RollingGo `toAirport`. */
  primaryIata: string;
  /**
   * Secondary airport IATAs to probe when the primary returns no offers
   * (e.g. CLE for Lost Lands, LPL for Creamfields).
   */
  alternateIatas?: string[];
  /**
   * MCP searchAirports keywords — English / IATA first (official preference).
   */
  airportKeywords: string[];
};

/**
 * Catalog keyed by activity `legacyId`.
 * Keep in sync with `activity.seed.ts` / `activity-catalog-seed-data.mjs`.
 */
export const ACTIVITY_PRIMARY_AIRPORTS: Record<number, ActivityAirportProfile> =
  {
    // Tomorrowland Thailand — international gateway Bangkok (UTP is closer but thinner).
    1: {
      primaryIata: 'BKK',
      alternateIatas: ['UTP'],
      airportKeywords: ['Bangkok', 'BKK', 'Utapao', 'UTP', '曼谷', '乌塔保'],
    },
    // Defqon.1 — Walibi Holland / Biddinghuizen → Amsterdam.
    2: {
      primaryIata: 'AMS',
      airportKeywords: ['Amsterdam', 'AMS', '阿姆斯特丹'],
    },
    // S2O Korea — Seoul Land → Incheon.
    3: {
      primaryIata: 'ICN',
      alternateIatas: ['GMP'],
      airportKeywords: ['Incheon', 'Seoul', 'ICN', 'GMP', '仁川', '首尔'],
    },
    // STORM — Shenzhen.
    4: {
      primaryIata: 'SZX',
      airportKeywords: ['Shenzhen', 'SZX', '深圳', '宝安'],
    },
    // EDC Thailand — Phuket.
    5: {
      primaryIata: 'HKT',
      airportKeywords: ['Phuket', 'HKT', '普吉'],
    },
    // World DJ Festival — Tokyo.
    6: {
      primaryIata: 'HND',
      alternateIatas: ['NRT'],
      airportKeywords: [
        'Tokyo',
        'HND',
        'NRT',
        'Haneda',
        'Narita',
        '东京',
        '羽田',
        '成田',
      ],
    },
    // Tomorrowland Belgium — Boom / De Schorre → Brussels.
    7: {
      primaryIata: 'BRU',
      alternateIatas: ['ANR'],
      airportKeywords: [
        'Brussels',
        'BRU',
        'Antwerp',
        'ANR',
        '布鲁塞尔',
        '安特卫普',
      ],
    },
    // EDC Korea — Incheon.
    8: {
      primaryIata: 'ICN',
      alternateIatas: ['GMP'],
      airportKeywords: ['Incheon', 'Seoul', 'ICN', 'GMP', '仁川', '首尔'],
    },
    // UNTOLD Romania — Cluj-Napoca (not Bucharest).
    9: {
      primaryIata: 'CLJ',
      airportKeywords: ['Cluj', 'Cluj-Napoca', 'CLJ', '克卢日'],
    },
    // Creamfields — Warrington / Daresbury → Manchester (not London).
    10: {
      primaryIata: 'MAN',
      alternateIatas: ['LPL'],
      airportKeywords: [
        'Manchester',
        'MAN',
        'Liverpool',
        'LPL',
        '曼彻斯特',
        '利物浦',
      ],
    },
    // Ultra Japan — Tokyo.
    11: {
      primaryIata: 'HND',
      alternateIatas: ['NRT'],
      airportKeywords: [
        'Tokyo',
        'HND',
        'NRT',
        'Haneda',
        'Narita',
        '东京',
        '羽田',
        '成田',
      ],
    },
    // UNTOLD Dubai.
    12: {
      primaryIata: 'DXB',
      airportKeywords: ['Dubai', 'DXB', '迪拜'],
    },
    // EDC Orlando.
    13: {
      primaryIata: 'MCO',
      airportKeywords: ['Orlando', 'MCO', '奥兰多'],
    },
    // Soundstorm — Riyadh.
    14: {
      primaryIata: 'RUH',
      airportKeywords: ['Riyadh', 'RUH', '利雅得'],
    },
    // Ultra Europe — Split.
    15: {
      primaryIata: 'SPU',
      airportKeywords: ['Split', 'SPU', '斯普利特'],
    },
    // Tomorrowland Shanghai — Hongqiao primary for domestic; Pudong alternate.
    16: {
      primaryIata: 'SHA',
      alternateIatas: ['PVG'],
      airportKeywords: ['Shanghai', 'SHA', 'PVG', '上海', '虹桥', '浦东'],
    },
    // 808 Festival Bangkok.
    17: {
      primaryIata: 'BKK',
      airportKeywords: ['Bangkok', 'BKK', '曼谷'],
    },
    // VAC Zhuhai.
    18: {
      primaryIata: 'ZUH',
      airportKeywords: ['Zhuhai', 'ZUH', '珠海'],
    },
    // Lost Lands — Legend Valley / Thornville OH → Columbus (not LAX).
    19: {
      primaryIata: 'CMH',
      alternateIatas: ['CLE'],
      airportKeywords: [
        'Columbus',
        'CMH',
        'Cleveland',
        'CLE',
        'Ohio',
        'Thornville',
        '哥伦布',
        '俄亥俄',
      ],
    },
    // Ultra Taiwan — Taipei.
    21: {
      primaryIata: 'TPE',
      airportKeywords: ['Taipei', 'TPE', 'Taoyuan', '台北', '桃园'],
    },
  };

export function findActivityAirportProfile(
  activityLegacyId?: number,
): ActivityAirportProfile | undefined {
  if (activityLegacyId == null) return undefined;
  return ACTIVITY_PRIMARY_AIRPORTS[activityLegacyId];
}

/** Static airport IATA for RollingGo `toAirport` when the activity has a known fly-in. */
export function resolveActivityPrimaryAirportCode(
  activityLegacyId?: number,
): string | undefined {
  const profile = findActivityAirportProfile(activityLegacyId);
  const code = profile?.primaryIata?.trim().toUpperCase();
  return code?.length === 3 ? code : undefined;
}

/** Alternate airport IATAs to probe after the primary returns no offers. */
export function resolveActivityAlternateAirportCodes(
  activityLegacyId?: number,
): string[] {
  const profile = findActivityAirportProfile(activityLegacyId);
  if (!profile?.alternateIatas?.length) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  const primary = resolveActivityPrimaryAirportCode(activityLegacyId);
  if (primary) seen.add(primary);
  for (const raw of profile.alternateIatas) {
    const code = raw?.trim().toUpperCase();
    if (!code || code.length !== 3 || seen.has(code)) continue;
    seen.add(code);
    out.push(code);
  }
  return out;
}

export function listActivityAirportLegacyIds(): number[] {
  return Object.keys(ACTIVITY_PRIMARY_AIRPORTS)
    .map(Number)
    .filter((n) => Number.isFinite(n))
    .sort((a, b) => a - b);
}
