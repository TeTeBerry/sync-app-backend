/**
 * Per-activity primary fly-in airport for RollingGo flight quotes.
 * Prefer the realistic festival gateway (nearest major commercial airport
 * attendees actually use), not country-level hubs (e.g. LAX for all US).
 *
 * Keep in sync with `scripts/lib/activity-catalog-seed-data.mjs` legacyIds.
 */
export type ActivityAirportProfile = {
  /** Primary IATA used as RollingGo searchFlights `toCity`. */
  primaryIata: string;
  /**
   * Secondary IATAs to probe when the primary returns no offers
   * (e.g. CLE for Lost Lands, LPL for Creamfields).
   */
  alternateIatas?: string[];
  /**
   * MCP searchAirports keywords when static IATA cannot be used —
   * ordered by preference.
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
      airportKeywords: ['曼谷', 'Bangkok', 'BKK', '乌塔保', 'UTP'],
    },
    // Defqon.1 — Walibi Holland / Biddinghuizen → Amsterdam.
    2: {
      primaryIata: 'AMS',
      airportKeywords: ['阿姆斯特丹', 'Amsterdam', 'AMS'],
    },
    // S2O Korea — Seoul Land → Incheon.
    3: {
      primaryIata: 'ICN',
      alternateIatas: ['GMP'],
      airportKeywords: ['仁川', 'Incheon', '首尔', 'Seoul', 'ICN'],
    },
    // STORM — Shenzhen.
    4: {
      primaryIata: 'SZX',
      airportKeywords: ['深圳', '宝安', 'SZX'],
    },
    // EDC Thailand — Phuket.
    5: {
      primaryIata: 'HKT',
      airportKeywords: ['普吉', 'Phuket', 'HKT'],
    },
    // World DJ Festival — Tokyo.
    6: {
      primaryIata: 'HND',
      alternateIatas: ['NRT'],
      airportKeywords: ['东京', 'Tokyo', '羽田', '成田', 'HND', 'NRT'],
    },
    // Tomorrowland Belgium — Boom / De Schorre → Brussels.
    7: {
      primaryIata: 'BRU',
      alternateIatas: ['ANR'],
      airportKeywords: ['布鲁塞尔', 'Brussels', 'BRU', '安特卫普', 'Antwerp'],
    },
    // EDC Korea — Incheon.
    8: {
      primaryIata: 'ICN',
      alternateIatas: ['GMP'],
      airportKeywords: ['仁川', 'Incheon', '首尔', 'Seoul', 'ICN'],
    },
    // UNTOLD Romania — Cluj-Napoca (not Bucharest).
    9: {
      primaryIata: 'CLJ',
      airportKeywords: ['克卢日', 'Cluj', 'Cluj-Napoca', 'CLJ'],
    },
    // Creamfields — Warrington / Daresbury → Manchester (not London).
    10: {
      primaryIata: 'MAN',
      alternateIatas: ['LPL'],
      airportKeywords: ['曼彻斯特', 'Manchester', 'MAN', '利物浦', 'Liverpool'],
    },
    // Ultra Japan — Tokyo.
    11: {
      primaryIata: 'HND',
      alternateIatas: ['NRT'],
      airportKeywords: ['东京', 'Tokyo', '羽田', '成田', 'HND', 'NRT'],
    },
    // UNTOLD Dubai.
    12: {
      primaryIata: 'DXB',
      airportKeywords: ['迪拜', 'Dubai', 'DXB'],
    },
    // EDC Orlando.
    13: {
      primaryIata: 'MCO',
      airportKeywords: ['奥兰多', 'Orlando', 'MCO'],
    },
    // Soundstorm — Riyadh.
    14: {
      primaryIata: 'RUH',
      airportKeywords: ['利雅得', 'Riyadh', 'RUH'],
    },
    // Ultra Europe — Split.
    15: {
      primaryIata: 'SPU',
      airportKeywords: ['斯普利特', 'Split', 'SPU'],
    },
    // Tomorrowland Shanghai — Shanghai city / Hongqiao primary for domestic.
    16: {
      primaryIata: 'SHA',
      alternateIatas: ['PVG'],
      airportKeywords: ['上海', '虹桥', '浦东', 'SHA', 'PVG'],
    },
    // 808 Festival Bangkok.
    17: {
      primaryIata: 'BKK',
      airportKeywords: ['曼谷', 'Bangkok', 'BKK'],
    },
    // VAC Zhuhai.
    18: {
      primaryIata: 'ZUH',
      airportKeywords: ['珠海', 'ZUH'],
    },
    // Lost Lands — Legend Valley / Thornville OH → Columbus (not LAX).
    19: {
      primaryIata: 'CMH',
      alternateIatas: ['CLE'],
      airportKeywords: [
        '哥伦布',
        'Columbus',
        'CMH',
        '俄亥俄',
        'Ohio',
        'Thornville',
      ],
    },
    // Ultra Taiwan — Taipei.
    21: {
      primaryIata: 'TPE',
      airportKeywords: ['台北', 'Taipei', '桃园', 'TPE'],
    },
  };

export function findActivityAirportProfile(
  activityLegacyId?: number,
): ActivityAirportProfile | undefined {
  if (activityLegacyId == null) return undefined;
  return ACTIVITY_PRIMARY_AIRPORTS[activityLegacyId];
}

/** Static IATA for RollingGo `toCity` when the activity has a known fly-in airport. */
export function resolveActivityPrimaryAirportCode(
  activityLegacyId?: number,
): string | undefined {
  const profile = findActivityAirportProfile(activityLegacyId);
  const code = profile?.primaryIata?.trim().toUpperCase();
  return code?.length === 3 ? code : undefined;
}

/** Alternate IATAs to probe after the primary returns no offers. */
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
