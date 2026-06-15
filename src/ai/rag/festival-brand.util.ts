export interface FestivalBrand {
  /** Canonical activity code when linking to catalog */
  code: string;
  /** Display name */
  name: string;
  /** Keyword / alias fragments for matching (lowercase) */
  aliases: string[];
}

/** Known electronic music festival brands for keyword matching */
export const FESTIVAL_BRANDS: FestivalBrand[] = [
  {
    code: 'vac-zhuhai',
    name: 'VAC',
    aliases: [
      'vac',
      'vision',
      'colour',
      'color',
      'soundscape',
      'vision & colour',
      'vision and colour',
    ],
  },
  {
    code: 'edc-thailand',
    name: 'EDC Thailand',
    aliases: ['edc thailand', 'edc泰国', '泰国edc', 'edc thai'],
  },
  {
    code: 'edc-korea',
    name: 'EDC Korea',
    aliases: [
      'edc korea',
      'edc korea 2026',
      'edc韩国',
      '韩国edc',
      'korea edc',
      'edckorea',
      '仁川edc',
    ],
  },
  {
    code: 'edc',
    name: 'EDC China',
    aliases: ['edc china', 'edc中国', 'edc电音', 'edc'],
  },
  {
    code: 'ultra-europe',
    name: 'Ultra Europe',
    aliases: ['ultra europe', 'ultra european', '欧洲ultra'],
  },
  {
    code: 'tomorrowland',
    name: 'Tomorrowland',
    aliases: [
      'tomorrowland',
      'tomorrowland thailand',
      'tml泰国',
      'tmw',
      '明日世界',
      '芭提雅',
      'pattaya',
    ],
  },
  {
    code: 'storm',
    name: '风暴电音节',
    aliases: [
      '风暴',
      'storm',
      '口味王风暴',
      '风暴电音节',
      'ultra 成都',
      'ultra chengdu',
    ],
  },
  {
    code: 'ade',
    name: 'ADE',
    aliases: ['ade', 'amsterdam dance event'],
  },
  {
    code: 'creamfields',
    name: 'Creamfields',
    aliases: ['creamfields', 'creamfield'],
  },
  {
    code: 'mysteryland',
    name: 'Mysteryland',
    aliases: ['mysteryland', 'mystery land'],
  },
  {
    code: 'untold',
    name: 'Untold',
    aliases: ['untold'],
  },
  {
    code: 'electric-zoo',
    name: 'Electric Zoo',
    aliases: ['electric zoo', 'electriczoo', 'ezoo'],
  },
  {
    code: 'dwp',
    name: 'DWP',
    aliases: ['dwp', 'djakarta warehouse project'],
  },
];

export interface FestivalBrandMatch {
  brand: FestivalBrand;
  /** Alias substring that matched */
  matchedKeyword: string;
}

function compactText(text: string): string {
  return text.toLowerCase().replace(/[\s.\-_/]+/g, '');
}

function regionHint(text: string): 'thailand' | 'china' | undefined {
  const lower = text.toLowerCase();
  if (/泰国|thailand|泰國|曼谷|pattaya|芭提雅/.test(lower)) return 'thailand';
  if (/中国|china|阳澄湖|苏州/.test(lower)) return 'china';
  return undefined;
}

/** Resolve a festival brand from free-text event name or keyword */
export function resolveFestivalBrand(
  text: string,
): FestivalBrandMatch | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;

  const lower = trimmed.toLowerCase();
  const compact = compactText(trimmed);
  const region = regionHint(trimmed);

  let best:
    | { brand: FestivalBrand; matchedKeyword: string; score: number }
    | undefined;

  for (const brand of FESTIVAL_BRANDS) {
    if (brand.code === 'edc' && region === 'thailand') continue;
    if (brand.code === 'edc-thailand' && region === 'china') continue;
    if (
      brand.code === 'edc' &&
      /vac|vision|colour|珠海|hilton|希尔顿/.test(lower)
    ) {
      continue;
    }
    if (
      (brand.code === 'edc' || brand.code === 'edc-thailand') &&
      !/edc/.test(compact) &&
      !brand.aliases.some((alias) => alias === 'edc' && compact.includes('edc'))
    ) {
      continue;
    }

    for (const alias of brand.aliases) {
      const aliasLower = alias.toLowerCase();
      const aliasCompact = compactText(alias);
      if (!aliasCompact) continue;

      const matches =
        compact.includes(aliasCompact) ||
        aliasCompact.includes(compact) ||
        lower.includes(aliasLower) ||
        (aliasCompact.length >= 3 && compact.includes(aliasCompact));

      if (!matches) continue;

      const score = aliasCompact.length;
      if (!best || score > best.score) {
        best = { brand, matchedKeyword: alias, score };
      }
    }
  }

  return best
    ? { brand: best.brand, matchedKeyword: best.matchedKeyword }
    : undefined;
}

/** Extract city/venue hint from event title (e.g. 深圳站) */
export function extractLocationFromEventName(text: string): string | undefined {
  const station = text.match(
    /(?:^|[\s\-—–·])([\u4e00-\u9fff]{2,8})站(?:$|[\s\-—–·])/,
  );
  if (station) return station[1];

  const cities = [
    '深圳',
    '上海',
    '北京',
    '广州',
    '珠海',
    '苏州',
    '成都',
    '杭州',
    '南京',
    '武汉',
    '重庆',
  ];
  for (const city of cities) {
    if (text.includes(city)) return city;
  }

  return undefined;
}
