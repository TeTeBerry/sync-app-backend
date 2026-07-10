import type { Activity } from '../../../database/schemas/activity.schema';
import type { TravelGuideVenueTransportOption } from '@sync/travel-guide-contracts';
import {
  type TravelGuideRegionKind,
  travelGuideRegionKind,
} from './travel-guide-international.util';
import {
  filterDomesticTransportHints,
  resolveDepartureAirportLabel,
  resolveDestinationAirportLabel,
} from './travel-guide-departure-airport.util';
import { destinationCityFromActivityLocation } from '../map/travel-guide-intercity.util';
import type { DrivingRouteSummary } from '../map/travel-guide-map.types';
import { getTravelGuideCopy } from './travel-guide-copy';

export interface DestinationTransportProfile {
  regionKind: TravelGuideRegionKind;
  destinationCity: string;
  thailand: boolean;
  bangkok: boolean;
  phuket: boolean;
  korea: boolean;
  japan: boolean;
  /** 目的地是否有城市轨道交通（国内地铁、曼谷 BTS/MRT、仁川 AREX 等） */
  hasUrbanRail: boolean;
  /** 是否可用高铁/动车作为城际方式（仅中国大陆/部分港澳台线路） */
  hasHighSpeedRail: boolean;
}

/** 中国大陆已开通城市轨道交通的主要城市（不含仅有城际/单线的中小城） */
const DOMESTIC_METRO_CITIES = new Set([
  '上海',
  '北京',
  '广州',
  '深圳',
  '杭州',
  '南京',
  '成都',
  '武汉',
  '重庆',
  '西安',
  '天津',
  '青岛',
  '厦门',
  '长沙',
  '郑州',
  '宁波',
  '合肥',
  '昆明',
  '南宁',
  '大连',
  '沈阳',
  '哈尔滨',
  '济南',
  '福州',
  '南昌',
  '贵阳',
  '海口',
  '苏州',
  '无锡',
  '常州',
  '东莞',
  '佛山',
  '珠海',
  '温州',
  '绍兴',
  '长春',
  '太原',
  '石家庄',
  '兰州',
  '乌鲁木齐',
  '呼和浩特',
  '徐州',
  '南通',
  '芜湖',
  '洛阳',
  '厦门',
]);

export interface VenueTransportCapabilities {
  airportArrival: boolean;
  rideHail: { available: boolean; label: string };
  urbanRail: { available: boolean; label: string };
  localMinibus: { available: boolean; label: string };
  taxiShuttle: { available: boolean; label: string };
  selfDrive: boolean;
  /** 该目的地不应出现在会场接驳中的关键词（用于过滤 LLM 编造） */
  forbiddenInVenue: RegExp;
}

function resolveDomesticHasUrbanRail(city: string): boolean {
  const normalized = city.replace(/市$/, '').trim();
  return DOMESTIC_METRO_CITIES.has(normalized);
}

function resolveHmtHasUrbanRail(corpus: string): boolean {
  if (/香港|hong\s*kong/.test(corpus)) return true;
  if (/台北|taoyuan|桃园|高雄|kaohsiung|台中|taichung/.test(corpus)) {
    return true;
  }
  return false;
}

export function resolveVenueTransportCapabilities(
  profile: DestinationTransportProfile,
  input: Pick<
    TravelGuideTransportBuildInput,
    'interCity' | 'selfDrive' | 'activity'
  >,
): VenueTransportCapabilities {
  const corpus =
    `${input.activity?.name ?? ''} ${input.activity?.location ?? ''} ${profile.destinationCity}`.toLowerCase();

  const baseForbidden =
    profile.regionKind === 'overseas' && profile.thailand && !profile.bangkok
      ? /高铁|12306|BTS|MRT|地铁|动车|国内地铁|深圳北|虹桥|北站|南站|东站|西站/
      : profile.regionKind === 'overseas' && profile.thailand && profile.bangkok
        ? /高铁|12306|国内地铁|深圳北|虹桥|北站|南站/
        : profile.regionKind === 'domestic' && !profile.hasUrbanRail
          ? /地铁|轻轨|MTR|BTS|MRT/
          : /高铁|12306|深圳北|虹桥/;

  if (profile.regionKind === 'overseas') {
    if (profile.thailand) {
      return {
        airportArrival: input.interCity,
        rideHail: {
          available: true,
          label: 'Grab / Bolt 网约车',
        },
        urbanRail: {
          available: profile.bangkok,
          label: 'BTS / MRT + 步行或短驳',
        },
        localMinibus: {
          available: !profile.bangkok,
          label: '双条车 / 当地小巴 / 出租车',
        },
        taxiShuttle: { available: true, label: '出租车 / 酒店 Shuttle' },
        selfDrive: input.selfDrive,
        forbiddenInVenue: baseForbidden,
      };
    }
    if (profile.korea) {
      return {
        airportArrival: input.interCity,
        rideHail: { available: true, label: 'Kakao T 网约车' },
        urbanRail: {
          available: true,
          label: 'AREX 机场铁路 + 仁川地铁 1 号线',
        },
        localMinibus: { available: false, label: '' },
        taxiShuttle: { available: true, label: '出租车 / 酒店 Shuttle' },
        selfDrive: input.selfDrive,
        forbiddenInVenue: baseForbidden,
      };
    }
    if (profile.japan) {
      return {
        airportArrival: input.interCity,
        rideHail: { available: true, label: 'Uber Japan / Japan Taxi' },
        urbanRail: {
          available: true,
          label: '山手线 / 东京 Metro / 临海线',
        },
        localMinibus: { available: false, label: '' },
        taxiShuttle: { available: true, label: '出租车 / 酒店 Shuttle' },
        selfDrive: input.selfDrive,
        forbiddenInVenue: baseForbidden,
      };
    }
    return {
      airportArrival: input.interCity,
      rideHail: {
        available: true,
        label: '当地网约车 / 出租车',
      },
      urbanRail: { available: false, label: '' },
      localMinibus: { available: false, label: '' },
      taxiShuttle: { available: true, label: '出租车 / 酒店 Shuttle' },
      selfDrive: input.selfDrive,
      forbiddenInVenue: baseForbidden,
    };
  }

  if (profile.regionKind === 'hmt') {
    const urbanLabel = /香港|hong\s*kong/.test(corpus)
      ? '港铁 MTR + 步行'
      : /台北|桃园|高雄|台中/.test(corpus)
        ? '捷运 / 地铁 + 步行'
        : '地铁 / 轻轨 + 步行';
    return {
      airportArrival: input.interCity,
      rideHail: { available: true, label: '网约车 / 出租车' },
      urbanRail: {
        available: profile.hasUrbanRail,
        label: urbanLabel,
      },
      localMinibus: { available: false, label: '' },
      taxiShuttle: { available: false, label: '' },
      selfDrive: input.selfDrive,
      forbiddenInVenue: baseForbidden,
    };
  }

  return {
    airportArrival: input.interCity,
    rideHail: { available: true, label: '网约车 / 出租车' },
    urbanRail: {
      available: profile.hasUrbanRail,
      label: '地铁 / 公交 + 步行',
    },
    localMinibus: { available: false, label: '' },
    taxiShuttle: { available: false, label: '' },
    selfDrive: input.selfDrive,
    forbiddenInVenue: baseForbidden,
  };
}

/** 城际/国际段文案，不应出现在会场接驳 lines 中 */
export function isInterCityTransportLine(line: string): boolean {
  const t = line.trim();
  if (!t) return true;

  if (
    /往返机票|搭乘国际航班|国际航班.*飞往|建议从.*飞往|从.*国际机场.*飞往/.test(
      t,
    )
  ) {
    return true;
  }
  if (/提前\s*2[\-–—]8\s*周/.test(t) && /机票|票量/.test(t)) {
    return true;
  }
  if (/12306|高铁.*至|动车.*至/.test(t)) {
    return true;
  }
  if (
    /建议从/.test(t) &&
    /(国际机场|机场（[A-Z]{3}）)/.test(t) &&
    /飞往/.test(t)
  ) {
    return true;
  }
  return false;
}

export function filterVenueTransportLines(lines: string[]): string[] {
  return lines
    .map((line) => line.trim())
    .filter((line) => line && !isInterCityTransportLine(line));
}

function pickVenueTransportHint(
  hints: string[],
  pattern: RegExp,
): string | undefined {
  return hints.find((h) => pattern.test(h) && !isInterCityTransportLine(h));
}

function buildOverseasUrbanRailVenueLines(
  input: TravelGuideTransportBuildInput,
  profile: DestinationTransportProfile,
): string[] {
  const venue = input.venueTitle;
  const dest = profile.destinationCity;

  if (profile.thailand && profile.bangkok) {
    return [
      `曼谷活动日可乘 BTS（天铁）或 MRT（地铁）至最近站点，再步行或短途 Grab 至「${venue}」。`,
      '高峰时段天铁可能限流，备 Grab 作为散场备选；注意末班车时间。',
      pickVenueTransportHint(input.transportHints, /BTS|MRT|天铁|地铁/) ??
        '以 Google Maps 实时路线为准。',
    ];
  }

  if (profile.korea) {
    return [
      `活动日可乘 AREX 机场铁路至仁川站，转地铁 1 号线往永宗岛方向至会场附近站，再步行或 Kakao T 短驳至「${venue}」。`,
      '高峰时段地铁可能限流，备 Kakao T 作为散场备选；注意末班车时间。',
      pickVenueTransportHint(
        input.transportHints,
        /AREX|地铁|Kakao|仁川|永宗/,
      ) ?? '以 Naver Map / Google Maps 实时路线为准。',
    ];
  }

  if (profile.japan) {
    return [
      `活动日可乘山手线 / 东京 Metro / 临海线等轨道交通至最近站点，再步行或短途网约车至「${venue}」。`,
      '高峰时段电车可能拥挤，备 Uber Japan / Japan Taxi 作为散场备选；注意末班车时间。',
      pickVenueTransportHint(
        input.transportHints,
        /山手线|Metro|临海线|地铁|电车|羽田|成田/,
      ) ?? '以 Google Maps / Navitime 实时路线为准。',
    ];
  }

  return [
    `在${dest}乘当地轨道交通至最近站点，再步行或短途打车至「${venue}」。`,
    '散场高峰建议提前预约车辆；注意末班车时间。',
    pickVenueTransportHint(input.transportHints, /地铁|轻轨|铁路|电车/) ??
      '以 Google Maps 实时路线为准。',
  ];
}

function overseasVenueLineForbidden(
  profile: DestinationTransportProfile,
  line: string,
): boolean {
  if (profile.thailand) return false;
  if (/曼谷|bangkok|BTS|MRT|天铁|Grab|Bolt|双条车|Songthaew/i.test(line)) {
    return true;
  }
  if (profile.japan && /Kakao T|AREX|仁川地铁/.test(line)) {
    return true;
  }
  if (!profile.korea && /Kakao T|AREX|仁川地铁/.test(line)) {
    return true;
  }
  return false;
}

/** 过滤 LLM 或模板中不符合目的地能力的会场接驳项 */
export function sanitizeVenueTransportOptions(
  profile: DestinationTransportProfile,
  options: TravelGuideVenueTransportOption[],
): TravelGuideVenueTransportOption[] {
  const caps = resolveVenueTransportCapabilities(profile, {
    interCity: true,
    selfDrive: true,
    activity: undefined,
  });
  return options
    .map((opt) => {
      const lines = filterVenueTransportLines(opt.lines).filter(
        (line) => !overseasVenueLineForbidden(profile, line),
      );
      if (!lines.length) return null;
      return { label: opt.label, lines };
    })
    .filter((opt): opt is TravelGuideVenueTransportOption => opt != null)
    .filter((opt) => {
      const text = `${opt.label} ${opt.lines.join(' ')}`;
      if (/地铁|轻轨|MTR|BTS/.test(opt.label) && !caps.urbanRail.available) {
        return false;
      }
      if (
        /Grab|Bolt/.test(opt.label) &&
        profile.regionKind === 'overseas' &&
        !profile.thailand
      ) {
        return false;
      }
      if (/双条车|Songthaew/i.test(opt.label) && !caps.localMinibus.available) {
        return false;
      }
      if (profile.regionKind === 'overseas') {
        if (caps.forbiddenInVenue.test(text)) return false;
        if (/高铁|12306|动车/.test(text)) return false;
      }
      return true;
    });
}

/** 会场接驳以地图构建为准；LLM 仅润色同名 label 的 lines，禁止增删方式 */
export function mergeVenueTransportWithLlmPolish(
  ranked: TravelGuideVenueTransportOption[],
  llmOptions: TravelGuideVenueTransportOption[] | undefined,
  input: TravelGuideTransportBuildInput,
): TravelGuideVenueTransportOption[] {
  const profile = resolveDestinationTransportProfile(input);
  const sanitized = sanitizeVenueTransportOptions(profile, ranked);
  if (!llmOptions?.length) return sanitized;

  const llmByLabel = new Map(llmOptions.map((o) => [o.label, o]));
  const merged = sanitized.map((opt) => {
    const polished = llmByLabel.get(opt.label);
    if (!polished) return opt;
    const dropGrab =
      profile.regionKind === 'overseas' && !profile.thailand
        ? /Grab|Bolt/
        : null;
    const polishedLines = polished.lines
      .map((l) => l.trim())
      .filter((l) => l && !isInterCityTransportLine(l))
      .filter((l) => !dropGrab || !dropGrab.test(l));
    const safeLines = polishedLines.filter(
      (l) =>
        sanitizeVenueTransportOptions(profile, [
          { label: opt.label, lines: [l] },
        ]).length > 0,
    );
    return {
      label: opt.label,
      lines: safeLines.length ? safeLines : opt.lines,
    };
  });
  return sanitizeVenueTransportOptions(profile, merged);
}

export interface TravelGuideTransportBuildInput {
  departure: string;
  venueTitle: string;
  venueReadableAddress: string;
  selfDrive: boolean;
  interCity: boolean;
  route?: DrivingRouteSummary;
  /** 高德公交/地铁逐步明细（同城非自驾） */
  transitDetailLines?: string[];
  transportHints: string[];
  destinationCity?: string;
  departureCity?: string;
  activity?: Pick<Activity, 'name' | 'location' | 'region'>;
  locale?: 'zh' | 'en';
}

export function resolveDestinationTransportProfile(
  input: Pick<TravelGuideTransportBuildInput, 'destinationCity' | 'activity'>,
): DestinationTransportProfile {
  const regionKind = input.activity
    ? travelGuideRegionKind(input.activity)
    : 'domestic';
  const destinationCity =
    input.destinationCity?.trim() ||
    destinationCityFromActivityLocation(input.activity?.location) ||
    '目的地';
  const corpus =
    `${input.activity?.name ?? ''} ${input.activity?.location ?? ''} ${destinationCity}`.toLowerCase();
  const thailand =
    /泰国|thailand|普吉|phuket|芭提雅|pattaya|patong|苏梅|samui|清迈|chiang\s*mai/.test(
      corpus,
    );
  const bangkok = /曼谷|bangkok/.test(corpus);
  const phuket = /普吉|phuket|patong/.test(corpus);
  const korea =
    /韩国|korea|仁川|incheon|首尔|seoul|永宗|yeongjong|edckorea|edc korea|s2o/.test(
      corpus,
    );
  const japan =
    /日本|japan|东京|tokyo|台场|odaiba|海の森|羽田|haneda|成田|narita|wdjf|ultra japan|有明|ariake/.test(
      corpus,
    );

  let hasUrbanRail = false;
  if (regionKind === 'domestic') {
    hasUrbanRail = resolveDomesticHasUrbanRail(destinationCity);
  } else if (regionKind === 'hmt') {
    hasUrbanRail = resolveHmtHasUrbanRail(corpus);
  } else if (regionKind === 'overseas' && bangkok) {
    hasUrbanRail = true;
  } else if (regionKind === 'overseas' && korea) {
    hasUrbanRail = true;
  } else if (regionKind === 'overseas' && japan) {
    hasUrbanRail = true;
  }

  return {
    regionKind,
    destinationCity,
    thailand,
    bangkok,
    phuket,
    korea,
    japan,
    hasUrbanRail,
    hasHighSpeedRail: regionKind === 'domestic' || regionKind === 'hmt',
  };
}

export function transportSectionTitle(
  interCity: boolean,
  profile: DestinationTransportProfile,
  locale: 'zh' | 'en' = 'zh',
): string {
  const copy = getTravelGuideCopy(locale).section;
  if (!interCity) return copy.transport;
  if (profile.regionKind === 'overseas') return copy.internationalTravel;
  return copy.interCityTransport;
}

export function venueTransportSectionTitle(locale: 'zh' | 'en' = 'zh'): string {
  return getTravelGuideCopy(locale).section.venueTransport;
}

/** 城际/国际段：从出发地到目的地城市，不含会场最后一段。 */
export function buildInterCityTransportLines(
  input: TravelGuideTransportBuildInput,
): string[] {
  if (input.locale === 'en') {
    return buildInterCityTransportLinesEn(input);
  }
  const profile = resolveDestinationTransportProfile(input);
  const { departure, venueTitle, venueReadableAddress, selfDrive, interCity } =
    input;
  const dest = profile.destinationCity;
  const venueLabel = venueReadableAddress || venueTitle;

  if (!interCity) {
    return buildSameCityTransportLines(input, profile);
  }

  const lines: string[] = [];

  if (profile.regionKind === 'overseas') {
    const depAirport = resolveDepartureAirportLabel(
      departure,
      input.departureCity,
    );
    const destAirport = resolveDestinationAirportLabel(
      profile,
      input.activity?.location,
    );

    lines.push(
      `从「${departure}」前往${dest}为国际出行，建议提前 1–2 天飞抵，留出入境、取卡与休整时间。`,
      `建议从${depAirport}搭乘国际航班飞往${destAirport}；往返机票建议提前 2–8 周关注，电音节期间票量与房价波动大。`,
    );
    if (profile.thailand) {
      lines.push(
        '入境需准备护照、返程机票与酒店订单；落地签/免签政策以入境当日官方为准。',
        '抵目的地机场后的 Grab、Shuttle 等接驳见下方「会场接驳」。',
      );
    } else if (profile.korea) {
      lines.push(
        '入境需准备护照、签证/K-ETA（如适用）、返程机票与酒店订单；以入境当日韩国官方为准。',
        '抵仁川 ICN 后的 AREX、Kakao T 等接驳见下方「会场接驳」。',
      );
    } else if (profile.japan) {
      lines.push(
        '入境需准备护照、Visit Japan Web 入境审查（如适用）、返程机票与酒店订单；以入境当日日本官方为准。',
        '抵羽田/成田后的京急/成田特快、东京 Metro 等接驳见下方「会场接驳」。',
      );
    } else {
      lines.push(
        '提前确认签证/入境要求；当地叫车与会场接驳见下方「会场接驳」。',
      );
    }
    if (selfDrive) {
      lines.push(
        `若在当地租车，取车后导航「${venueLabel}」；请确认国际驾照/翻译件要求。`,
      );
    }
    if (!lines.some((l) => l.includes('返程'))) {
      lines.push('国际返程机票建议与去程同时预订，活动前后舱位紧张。');
    }
    return lines;
  }

  if (selfDrive) {
    lines.push(
      `从「${departure}」自驾前往${dest}「${venueLabel}」路程较远，请提前在导航 App 规划路线并预留休息点。`,
    );
    if (input.route && input.route.distanceKm >= 120) {
      lines.push(
        `全程自驾参考：约 ${input.route.distanceKm} km / ${input.route.durationMin} 分钟（以出发日路况为准）。`,
      );
    }
    lines.push(
      `抵${dest}后停车与离场指引见「停车指引」；日常前往会场的方式见「会场接驳」。`,
    );
  } else {
    lines.push(
      `从「${departure}」前往${dest}为跨城出行，建议优先乘坐${profile.hasHighSpeedRail ? '高铁/动车或' : ''}飞机抵达${dest}主要枢纽站或机场。`,
      `城际票建议提前购买；抵${dest}后的打车、地铁等会场接驳见下方「会场接驳」。`,
    );
    appendUniqueHints(lines, input.transportHints, {
      excludePattern: /接驳（|→ 场馆|枢纽至|抵深后|抵城后接驳|地铁11/,
    });
    if (
      input.route &&
      input.route.distanceKm > 0 &&
      input.route.distanceKm < 120
    ) {
      lines.push(
        `枢纽至会场约 ${input.route.distanceKm} km / ${input.route.durationMin} 分钟（打车或轨道交通，高峰多预留）。`,
      );
    }
  }

  if (!lines.some((l) => l.includes('返程'))) {
    lines.push('返程城际票尤其注意电音节前后票量紧张，建议与去程同时购买。');
  }

  return lines;
}

function buildSameCityTransportLines(
  input: TravelGuideTransportBuildInput,
  profile: DestinationTransportProfile,
): string[] {
  const { departure, venueTitle, venueReadableAddress, selfDrive, route } =
    input;
  const venueLabel = venueReadableAddress || venueTitle;
  const lines = [
    `从「${departure}」前往「${venueLabel}」，建议活动日提前出发，预留入场与安检时间。`,
  ];

  if (selfDrive && route) {
    lines.push(
      `自驾：参考行程约 ${route.distanceKm} km / ${route.durationMin} 分钟（以出发日路况为准）。`,
      '散场后场馆周边易拥堵，请提前确认停车场与离场路线。',
    );
  } else if (selfDrive) {
    lines.push(`自驾导航「${venueTitle}」，出发前在地图 App 查看实时路况。`);
  } else if (input.transitDetailLines?.length) {
    lines.push(...input.transitDetailLines);
    if (route) {
      lines.push(
        `全程参考：约 ${route.distanceKm} km / ${route.durationMin} 分钟（含步行接驳，以出发日为准）。`,
      );
    }
  } else if (route) {
    const modeHint = profile.hasUrbanRail ? '地铁/公交/网约车' : '公交/网约车';
    lines.push(
      `参考行程约 ${route.distanceKm} km / ${route.durationMin} 分钟，具体${modeHint}方案见「会场接驳」。`,
    );
  } else {
    const modeHint = profile.hasUrbanRail ? '地铁/公交/网约车' : '公交/网约车';
    lines.push(`具体${modeHint}方案见下方「会场接驳」。`);
  }

  appendUniqueHints(lines, input.transportHints);
  return lines;
}

/** 目的地市内最后一段：机场/酒店/车站 → 会场。 */
export function buildVenueTransportOptions(
  input: TravelGuideTransportBuildInput,
): TravelGuideVenueTransportOption[] {
  if (input.locale === 'en') {
    return buildVenueTransportOptionsEn(input);
  }
  const profile = resolveDestinationTransportProfile(input);

  if (profile.regionKind === 'overseas') {
    return buildOverseasVenueOptions(input, profile);
  }
  if (profile.regionKind === 'hmt') {
    return buildHmtVenueOptions(input, profile);
  }
  return buildDomesticVenueOptions(input, profile);
}

function buildOverseasVenueOptions(
  input: TravelGuideTransportBuildInput,
  profile: DestinationTransportProfile,
): TravelGuideVenueTransportOption[] {
  const caps = resolveVenueTransportCapabilities(profile, input);
  const dest = profile.destinationCity;
  const venue = input.venueTitle;
  const address = input.venueReadableAddress;
  const options: TravelGuideVenueTransportOption[] = [];
  const airportHint = pickVenueTransportHint(
    input.transportHints,
    /机场|shuttle|接驳/i,
  );

  if (caps.airportArrival) {
    options.push({
      label: profile.thailand
        ? '机场落地 + Grab / Shuttle'
        : '机场 → 会场/酒店',
      lines: profile.thailand
        ? [
            `飞抵${dest}机场后，可 Grab/Bolt 直达酒店或「${venue}」；大型电音节常售 Official Shuttle 套票，购票时留意是否含接驳。`,
            airportHint ??
              '机场出口有正规出租车与网约车候车区，勿乘坐无标识黑车；提前下载 Grab 并绑定支付方式。',
            `活动日再前往「${venue}」，${address || '以 Google Maps 导航为准'}。`,
          ]
        : [
            `飞抵${dest}机场后，可乘机场大巴/当地网约车前往酒店，活动日再前往「${venue}」。`,
            airportHint ??
              '提前查好末班接驳与入境取行李时间，深夜到达建议预约接机。',
            `${address || '会场地址详见官方地图'}`,
          ],
    });
  }

  if (caps.rideHail.available) {
    options.push({
      label: caps.rideHail.label,
      lines: profile.thailand
        ? [
            `在${dest}用 Grab 或 Bolt 从酒店直达「${venue}」，散场高峰建议提前预约并确认上车点。`,
            '泰国不支持国内滴滴/高德打车；需当地 SIM 或 eSIM 才能正常叫车。',
            '多人同行可分摊费用；凌晨散场注意安全结伴。',
          ]
        : [
            `在${dest}用当地主流网约车或出租车从酒店直达「${venue}」。`,
            '使用当地叫车 App 或酒店代叫，核对车牌与订单后再上车。',
            '散场高峰建议提前预约；多人同行可分摊费用。',
          ],
    });
  }

  if (caps.urbanRail.available) {
    options.push({
      label: caps.urbanRail.label,
      lines: buildOverseasUrbanRailVenueLines(input, profile),
    });
  }

  if (caps.localMinibus.available) {
    options.push({
      label: caps.localMinibus.label,
      lines: [
        profile.phuket
          ? `普吉岛无城市地铁/高铁，可搭双条车（Songthaew）、酒店班车或打表出租车至「${venue}」。`
          : `当地无城市轨道交通，可搭双条车/当地小巴或打表出租车至「${venue}」。`,
        airportHint ??
          '偏远场馆建议提前与酒店确认 Shuttle 时刻，或包车往返更省心。',
        '谈价前先问清是否打表；Grab 在多数旅游区覆盖更好。',
      ],
    });
  }

  if (caps.selfDrive) {
    options.push({
      label: '租车自驾',
      lines: input.route
        ? [
            `当地租车后导航「${venue}」，约 ${input.route.distanceKm} km / ${input.route.durationMin} 分钟。`,
            profile.thailand
              ? '泰国右舵左行，需国际驾照/翻译件；活动日停车可能紧张。'
              : '出发前确认停车区域与缴费方式。',
          ]
        : [
            `租车后导航「${venue}」，出发前查看实时路况与停车信息。`,
            profile.thailand
              ? '泰国右舵左行，请确认当地租车与驾照要求。'
              : '活动日建议提早抵达。',
          ],
    });
  } else if (caps.taxiShuttle.available) {
    options.push({
      label: caps.taxiShuttle.label,
      lines: [
        `酒店前台可代叫正规出租车，或咨询是否提供往返「${venue}」的 Shuttle。`,
        profile.thailand
          ? '大型电音节官网/购票页常公布官方 Shuttle 站点与时刻，建议优先参考。'
          : '以活动官方公布的接驳信息为准。',
        '散场时段路面拥堵，返程同样建议提前预约车辆。',
      ],
    });
  }

  return sanitizeVenueTransportOptions(
    profile,
    dedupeVenueOptions(options).slice(0, 4),
  );
}

function buildHmtVenueOptions(
  input: TravelGuideTransportBuildInput,
  profile: DestinationTransportProfile,
): TravelGuideVenueTransportOption[] {
  const caps = resolveVenueTransportCapabilities(profile, input);
  const dest = profile.destinationCity;
  const options: TravelGuideVenueTransportOption[] = [];
  const hubHint = pickVenueTransportHint(
    input.transportHints,
    /机场|高铁|枢纽|站|接驳/,
  );

  if (caps.airportArrival) {
    options.push({
      label: '机场 / 高铁枢纽 → 会场',
      lines: [
        `抵${dest}后从机场或高铁站换乘当地公交、${profile.hasUrbanRail ? '地铁' : '巴士'}或网约车前往「${input.venueTitle}」。`,
        hubHint ??
          (profile.hasUrbanRail
            ? '香港可用八达通乘 MTR；台湾可用悠游卡/一卡通乘捷运。'
            : '澳门等地以巴士、出租车或网约车为主。'),
        `${input.venueReadableAddress || '详见地图导航'}`,
      ],
    });
  }

  if (caps.urbanRail.available) {
    options.push({
      label: caps.urbanRail.label,
      lines: [
        `在${dest}乘${caps.urbanRail.label.replace(/ \+ 步行$/, '')}至最近站点，步行或短途打车至「${input.venueTitle}」。`,
        pickVenueTransportHint(input.transportHints, /地铁|MTR|捷运|轻轨/) ??
          '散场高峰可能限流，留意末班车；备用网约车。',
        '以当地地铁 App 或 Google Maps 实时路线为准。',
      ],
    });
  }

  if (caps.rideHail.available) {
    options.push({
      label: caps.rideHail.label,
      lines: [
        `酒店或枢纽打车至「${input.venueTitle}」，高峰约需 30–90 分钟（视路况）。`,
        '散场建议提前预约车辆，设置好上车点避开拥堵路段。',
        '多人同行可分摊费用，注意核对车牌。',
      ],
    });
  }

  if (caps.selfDrive) {
    options.push(buildSelfDriveVenueOption(input));
  }

  return sanitizeVenueTransportOptions(
    profile,
    dedupeVenueOptions(options).slice(0, 4),
  );
}

function buildDomesticVenueOptions(
  input: TravelGuideTransportBuildInput,
  profile: DestinationTransportProfile,
): TravelGuideVenueTransportOption[] {
  const caps = resolveVenueTransportCapabilities(profile, input);
  const dest = profile.destinationCity;
  const options: TravelGuideVenueTransportOption[] = [];
  const hubHint = pickVenueTransportHint(
    input.transportHints,
    /机场|北站|枢纽|站|接驳/,
  );

  if (caps.airportArrival) {
    const hubModes = profile.hasUrbanRail ? '打车或地铁' : '打车或公交';
    options.push({
      label: '枢纽接驳（机场/火车站 → 会场）',
      lines: [
        `抵${dest}后，从机场或火车站${hubModes}前往「${input.venueTitle}」。`,
        hubHint ??
          (profile.hasUrbanRail
            ? '枢纽出站层按指引乘地铁或网约车，高峰建议多预留 30–60 分钟。'
            : '枢纽出站层按指引乘公交或网约车，高峰建议多预留 30–60 分钟。'),
        input.route && input.route.distanceKm < 120
          ? `枢纽至会场约 ${input.route.distanceKm} km / ${input.route.durationMin} 分钟。`
          : `${input.venueReadableAddress || '详见高德地图导航'}`,
      ],
    });
  }

  if (caps.urbanRail.available) {
    const urbanLines = input.transitDetailLines?.length
      ? [
          ...input.transitDetailLines,
          '散场高峰地铁可能限流，备用网约车；以高德实时公交为准，提前查末班车时间。',
        ]
      : [
          `在${dest}乘地铁/公交至会场最近站点，步行或短途打车至「${input.venueTitle}」。`,
          pickVenueTransportHint(input.transportHints, /地铁|公交|线/) ??
            '以高德/百度实时公交为准；散场高峰地铁可能限流。',
          '备用网约车，提前查末班车时间。',
        ];
    options.push({
      label: caps.urbanRail.label,
      lines: urbanLines,
    });
  } else if (!input.interCity) {
    options.push({
      label: '公交 + 步行',
      lines: [
        `在${dest}乘公交至会场附近站点，步行或短途打车至「${input.venueTitle}」。`,
        pickVenueTransportHint(input.transportHints, /公交|线/) ??
          '以高德/百度实时公交为准；散场高峰可能拥堵。',
        '备用网约车，提前查末班车时间。',
      ],
    });
  }

  if (caps.rideHail.available) {
    options.push({
      label: caps.rideHail.label,
      lines: [
        `从酒店或任意地点打车至「${input.venueTitle}」，高峰约需 40–90 分钟（视路况）。`,
        '散场时段优先滴滴/高德预约，设置好上车点避开拥堵路段。',
        '多人同行可分摊费用，注意核对车牌与平台订单。',
      ],
    });
  }

  if (caps.selfDrive) {
    options.push(buildSelfDriveVenueOption(input));
  }

  return sanitizeVenueTransportOptions(
    profile,
    dedupeVenueOptions(options).slice(0, 4),
  );
}

function buildSelfDriveVenueOption(
  input: TravelGuideTransportBuildInput,
): TravelGuideVenueTransportOption {
  return {
    label: '自驾直达',
    lines: input.route
      ? [
          `导航「${input.venueTitle}」，约 ${input.route.distanceKm} km / ${input.route.durationMin} 分钟。`,
          '活动日停车场可能紧张，建议提早 1–2 小时抵达。',
          '散场后周边拥堵，可先在车内休息或约夜宵点汇合再离场。',
        ]
      : [
          `导航「${input.venueTitle}」，出发前在高德查看实时路况。`,
          '活动日停车场可能紧张，建议提早抵达。',
        ],
  };
}

function appendUniqueHints(
  lines: string[],
  hints: string[],
  options?: { excludePattern?: RegExp },
): void {
  for (const hint of hints) {
    if (!hint || lines.includes(hint)) continue;
    if (options?.excludePattern?.test(hint)) continue;
    lines.push(hint);
  }
}

function buildInterCityTransportLinesEn(
  input: TravelGuideTransportBuildInput,
): string[] {
  const profile = resolveDestinationTransportProfile(input);
  const { departure, venueTitle, venueReadableAddress, selfDrive, interCity } =
    input;
  const dest = profile.destinationCity;
  const venueLabel = venueReadableAddress || venueTitle;

  if (!interCity) {
    if (selfDrive) {
      return [
        `Drive to 「${venueTitle}」 and check live traffic before you leave.`,
        ...(input.route
          ? [
              `Reference drive: ~${input.route.distanceKm} km / ${input.route.durationMin} min (traffic-dependent).`,
            ]
          : []),
      ];
    }
    if (input.transitDetailLines?.length) {
      return [
        ...input.transitDetailLines,
        ...(input.route
          ? [
              `Trip reference: ~${input.route.distanceKm} km / ${input.route.durationMin} min including walks.`,
            ]
          : []),
      ];
    }
    return [
      `Use metro / bus / rideshare to 「${venueTitle}」; see Venue transfer for the last mile.`,
      ...(input.route
        ? [
            `Reference: ~${input.route.distanceKm} km / ${input.route.durationMin} min.`,
          ]
        : []),
    ];
  }

  if (profile.regionKind === 'overseas') {
    const depAirport = resolveDepartureAirportLabel(
      departure,
      input.departureCity,
    );
    const destAirport = resolveDestinationAirportLabel(
      profile,
      input.activity?.location,
    );
    const lines = [
      `Travel from 「${departure}」 to ${dest} is international — arrive 1–2 days early for immigration, SIM pickup, and rest.`,
      `Fly ${depAirport} → ${destAirport}; watch round-trip fares 2–8 weeks ahead (festival weeks spike).`,
    ];
    if (profile.thailand) {
      lines.push(
        'Bring passport, return flight, and hotel booking; VOA / visa-exemption rules follow official policy on arrival day.',
        'Airport Grab / Shuttle details are under Venue transfer.',
      );
    } else if (profile.korea) {
      lines.push(
        'Bring passport, visa / K-ETA if needed, return flight, and hotel booking.',
        'ICN AREX / Kakao T details are under Venue transfer.',
      );
    } else if (profile.japan) {
      lines.push(
        'Complete Visit Japan Web if applicable; bring passport, return flight, and hotel booking.',
        'HND/NRT rail and metro details are under Venue transfer.',
      );
    } else {
      lines.push(
        'Confirm visa / entry rules ahead; local rideshare and venue transfer are below.',
      );
    }
    if (selfDrive) {
      lines.push(
        `If renting locally, navigate to 「${venueLabel}」 and confirm international license rules.`,
      );
    }
    lines.push(
      'Book return flights with outbound — seats tighten around festival dates.',
    );
    return lines;
  }

  if (selfDrive) {
    return [
      `Self-drive from 「${departure}」 to ${dest} 「${venueLabel}」 — plan rest stops in your maps app.`,
      ...(input.route && input.route.distanceKm >= 120
        ? [
            `Drive reference: ~${input.route.distanceKm} km / ${input.route.durationMin} min.`,
          ]
        : []),
      `Parking is under Parking guide; daily venue access is under Venue transfer.`,
    ];
  }

  return [
    `Intercity trip from 「${departure}」 to ${dest} — prefer ${
      profile.hasHighSpeedRail ? 'high-speed rail or ' : ''
    }flights into the main hub / airport.`,
    `Buy intercity tickets early; last-mile rideshare / metro is under Venue transfer.`,
    'Return tickets sell out around festival weekends — book with outbound.',
  ];
}

function buildVenueTransportOptionsEn(
  input: TravelGuideTransportBuildInput,
): TravelGuideVenueTransportOption[] {
  const profile = resolveDestinationTransportProfile(input);
  const dest = profile.destinationCity;
  const venue = input.venueTitle;
  const address = input.venueReadableAddress || 'official venue map';

  if (profile.regionKind === 'overseas') {
    const options: TravelGuideVenueTransportOption[] = [
      {
        label: profile.thailand
          ? 'Airport + Grab / Shuttle'
          : 'Airport → hotel / venue',
        lines: [
          `After landing in ${dest}, rideshare or official shuttle to your hotel or 「${venue}」.`,
          `On show day, navigate to 「${venue}」 (${address}).`,
        ],
      },
      {
        label: profile.thailand
          ? 'Grab / Bolt'
          : profile.korea
            ? 'Kakao T'
            : profile.japan
              ? 'Uber Japan / taxi'
              : 'Local rideshare',
        lines: [
          `Rideshare from hotel to 「${venue}」; pre-book at peak exit and confirm the pickup point.`,
          'Local SIM / eSIM is usually required for rideshare apps.',
        ],
      },
    ];
    if (input.selfDrive) {
      options.push({
        label: 'Local rental car',
        lines: [
          `Navigate to 「${venue}」; confirm parking and international license rules.`,
        ],
      });
    }
    return dedupeVenueOptions(options);
  }

  if (profile.regionKind === 'hmt') {
    return [
      {
        label: 'Rail / ferry + last mile',
        lines: [
          `Arrive via rail / ferry into ${dest}, then metro or rideshare to 「${venue}」.`,
          `Address: ${address}.`,
        ],
      },
      {
        label: 'Rideshare / taxi',
        lines: [
          `Hotel → 「${venue}」 by rideshare or taxi; allow extra time after the show.`,
        ],
      },
    ];
  }

  const options: TravelGuideVenueTransportOption[] = [
    {
      label: profile.hasUrbanRail ? 'Metro / bus' : 'Bus / rideshare',
      lines: [
        `Use local transit or rideshare to 「${venue}」 (${address}).`,
        ...(input.transitDetailLines?.slice(0, 2) ?? []),
      ],
    },
    {
      label: 'Rideshare',
      lines: [`DiDi / Amap ride-hail to 「${venue}」; pre-book at peak exit.`],
    },
  ];
  if (input.selfDrive) {
    options.push({
      label: 'Self-drive',
      lines: [
        `Navigate to 「${venue}」 and arrive early — parking fills on show days.`,
      ],
    });
  }
  return dedupeVenueOptions(options);
}

function dedupeVenueOptions(
  options: TravelGuideVenueTransportOption[],
): TravelGuideVenueTransportOption[] {
  const seen = new Set<string>();
  return options.filter((o) => {
    if (seen.has(o.label)) return false;
    seen.add(o.label);
    return true;
  });
}

export function buildGenericInterCityHints(input: {
  departureLabel: string;
  destinationCity: string;
  venueTitle: string;
  selfDrive: boolean;
  regionKind?: TravelGuideRegionKind;
  activity?: Pick<Activity, 'name' | 'location' | 'region'>;
}): string[] {
  return buildInterCityTransportLines({
    departure: input.departureLabel,
    venueTitle: input.venueTitle,
    venueReadableAddress: input.destinationCity,
    selfDrive: input.selfDrive,
    interCity: true,
    transportHints: [],
    destinationCity: input.destinationCity,
    activity: input.activity,
  });
}
