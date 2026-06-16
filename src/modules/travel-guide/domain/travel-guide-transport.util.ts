import type { Activity } from '../../../database/schemas/activity.schema';
import type { TravelGuideVenueTransportOption } from './travel-guide.types';
import {
  type TravelGuideRegionKind,
  travelGuideRegionKind,
} from './travel-guide-international.util';
import { destinationCityFromActivityLocation } from '../map/travel-guide-intercity.util';
import type { DrivingRouteSummary } from '../map/travel-guide-map.types';

export interface DestinationTransportProfile {
  regionKind: TravelGuideRegionKind;
  destinationCity: string;
  thailand: boolean;
  bangkok: boolean;
  /** 目的地是否有城市轨道交通（国内地铁、曼谷 BTS/MRT 等） */
  hasUrbanRail: boolean;
  /** 是否可用高铁/动车作为城际方式（仅中国大陆/部分港澳台线路） */
  hasHighSpeedRail: boolean;
}

export interface TravelGuideTransportBuildInput {
  departure: string;
  venueTitle: string;
  venueReadableAddress: string;
  selfDrive: boolean;
  interCity: boolean;
  route?: DrivingRouteSummary;
  transportHints: string[];
  destinationCity?: string;
  activity?: Pick<Activity, 'name' | 'location' | 'region'>;
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

  return {
    regionKind,
    destinationCity,
    thailand,
    bangkok,
    hasUrbanRail:
      regionKind === 'domestic' ||
      regionKind === 'hmt' ||
      (regionKind === 'overseas' && bangkok),
    hasHighSpeedRail: regionKind === 'domestic' || regionKind === 'hmt',
  };
}

export function transportSectionTitle(
  interCity: boolean,
  profile: DestinationTransportProfile,
): string {
  if (!interCity) return '交通方案';
  if (profile.regionKind === 'overseas') return '国际出行';
  return '城际交通';
}

export function venueTransportSectionTitle(): string {
  return '会场接驳';
}

/** 城际/国际段：从出发地到目的地城市，不含会场最后一段。 */
export function buildInterCityTransportLines(
  input: TravelGuideTransportBuildInput,
): string[] {
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
    lines.push(
      `从「${departure}」前往${dest}为国际出行，建议提前 1–2 天飞抵，留出入境、取卡与休整时间。`,
    );
    if (profile.thailand) {
      lines.push(
        '常用航线：国内主要城市可直飞曼谷（BKK/DMK）或普吉（HKT）等，音乐节期间票量与房价波动大，建议尽早预订机票与酒店。',
        '入境需准备护照、返程机票与酒店订单；落地签/免签政策以入境当日官方为准。',
        '机场至酒店/会场的 Grab、Shuttle 等接驳方式见下方「会场接驳」，勿与国内城际/轨道交通混淆。',
      );
    } else {
      lines.push(
        `预订飞往${dest}的国际航班（或经枢纽中转），并提前确认签证/入境要求与返程票。`,
        '建议打印酒店与返程行程单备查；当地叫车与会场接驳见下方「会场接驳」。',
      );
    }
    if (selfDrive) {
      lines.push(
        `若在当地租车，取车后导航「${venueLabel}」；泰国等右舵国家请确认驾照翻译件/国际驾照要求。`,
      );
    }
    appendUniqueHints(lines, input.transportHints, {
      excludePattern: /地铁|高铁|动车|12306|北站|宝安机场|深圳/,
    });
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
    lines.push('返程城际票尤其注意音乐节前后票量紧张，建议与去程同时购买。');
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
  } else if (route) {
    lines.push(
      `参考行程约 ${route.distanceKm} km / ${route.durationMin} 分钟，具体地铁/公交/网约车方案见「会场接驳」。`,
    );
  } else {
    lines.push(`具体地铁/公交/网约车方案见下方「会场接驳」。`);
  }

  appendUniqueHints(lines, input.transportHints);
  return lines;
}

/** 目的地市内最后一段：机场/酒店/车站 → 会场。 */
export function buildVenueTransportOptions(
  input: TravelGuideTransportBuildInput,
): TravelGuideVenueTransportOption[] {
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
  const dest = profile.destinationCity;
  const venue = input.venueTitle;
  const address = input.venueReadableAddress;
  const options: TravelGuideVenueTransportOption[] = [];

  if (input.interCity) {
    options.push({
      label: profile.thailand
        ? '机场落地 + Grab / Shuttle'
        : '机场 → 会场/酒店',
      lines: profile.thailand
        ? [
            `飞抵${dest}机场后，可 Grab/Bolt 直达酒店或「${venue}」；大型电音节常售 Official Shuttle 套票，购票时留意是否含接驳。`,
            input.transportHints.find((h) => /机场|shuttle|接驳/i.test(h)) ??
              '机场出口有正规出租车与网约车候车区，勿乘坐无标识黑车；提前下载 Grab 并绑定支付方式。',
            `活动日再前往「${venue}」，${address || '以 Google Maps 导航为准'}。`,
          ]
        : [
            `飞抵${dest}机场后，可乘机场大巴/网约车前往酒店，活动日再前往「${venue}」。`,
            '提前查好末班接驳与入境取行李时间，深夜到达建议预约接机。',
            `${address || '会场地址详见官方地图'}`,
          ],
    });
  }

  options.push({
    label: 'Grab / Bolt 网约车',
    lines: [
      `在${dest}用 Grab 或 Bolt 从酒店直达「${venue}」，散场高峰建议提前预约并确认上车点。`,
      profile.thailand
        ? '泰国不支持国内滴滴/高德打车；需当地 SIM 或 eSIM 才能正常叫车。'
        : '使用当地主流网约车 App，核对车牌与订单后再上车。',
      '多人同行可分摊费用；凌晨散场注意安全结伴。',
    ],
  });

  if (profile.bangkok) {
    options.push({
      label: 'BTS / MRT + 步行或短驳',
      lines: [
        `曼谷活动日可乘 BTS（天铁）或 MRT（地铁）至最近站点，再步行或短途 Grab 至「${venue}」。`,
        '高峰时段天铁可能限流，备 Grab 作为散场备选；注意末班车时间。',
        input.transportHints.find((h) => /BTS|MRT|天铁|地铁/.test(h)) ??
          '以 Google Maps 实时路线为准（泰国无国内高铁/地铁系统）。',
      ],
    });
  } else if (profile.thailand) {
    options.push({
      label: '双条车 / 当地小巴 / 出租车',
      lines: [
        `普吉/芭提雅等无城市地铁，可搭双条车（Songthaew）、酒店班车或打表出租车至「${venue}」。`,
        '偏远场馆建议提前与酒店确认 Shuttle 时刻，或包车往返更省心。',
        '谈价前先问清是否打表；Grab 在多数旅游区覆盖更好。',
      ],
    });
  }

  if (input.selfDrive) {
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
  } else {
    options.push({
      label: '出租车 / 酒店 Shuttle',
      lines: [
        `酒店前台可代叫正规出租车，或咨询是否提供往返「${venue}」的 Shuttle。`,
        profile.thailand
          ? '大型音乐节官网/购票页常公布官方 Shuttle 站点与时刻，建议优先参考。'
          : '以活动官方公布的接驳信息为准。',
        '散场时段路面拥堵，返程同样建议提前预约车辆。',
      ],
    });
  }

  return dedupeVenueOptions(options).slice(0, 4);
}

function buildHmtVenueOptions(
  input: TravelGuideTransportBuildInput,
  profile: DestinationTransportProfile,
): TravelGuideVenueTransportOption[] {
  const dest = profile.destinationCity;
  const options: TravelGuideVenueTransportOption[] = [];

  if (input.interCity) {
    options.push({
      label: '高铁 / 航班 + 市内接驳',
      lines: [
        `抵${dest}后在机场/高铁站换乘地铁、巴士或网约车前往「${input.venueTitle}」。`,
        input.transportHints.find((h) => /机场|高铁|枢纽|站/.test(h)) ??
          '香港可用八达通乘 MTR，澳门/台湾按当地公交或地铁换乘。',
        `${input.venueReadableAddress || '详见地图导航'}`,
      ],
    });
  }

  if (profile.hasUrbanRail) {
    options.push({
      label: '地铁 / 轻轨 + 步行',
      lines: [
        `在${dest}乘 MTR/地铁/轻轨至最近站点，步行或短途打车至「${input.venueTitle}」。`,
        '散场高峰可能限流，留意末班车；备用网约车。',
        '以当地地铁 App 或 Google Maps 实时路线为准。',
      ],
    });
  }

  options.push({
    label: '网约车 / 出租车',
    lines: [
      `酒店或枢纽打车至「${input.venueTitle}」，高峰约需 30–90 分钟（视路况）。`,
      '散场建议提前预约车辆，设置好上车点避开拥堵路段。',
      '多人同行可分摊费用，注意核对车牌。',
    ],
  });

  if (input.selfDrive) {
    options.push(buildSelfDriveVenueOption(input));
  }

  return dedupeVenueOptions(options).slice(0, 4);
}

function buildDomesticVenueOptions(
  input: TravelGuideTransportBuildInput,
  profile: DestinationTransportProfile,
): TravelGuideVenueTransportOption[] {
  const dest = profile.destinationCity;
  const options: TravelGuideVenueTransportOption[] = [];

  if (input.interCity) {
    options.push({
      label: '枢纽接驳（机场/火车站 → 会场）',
      lines: [
        `抵${dest}后，从机场或火车站打车/地铁前往「${input.venueTitle}」。`,
        input.transportHints.find((h) => /机场|北站|枢纽|站|接驳/.test(h)) ??
          '枢纽出站层按指引乘地铁或网约车，高峰建议多预留 30–60 分钟。',
        input.route && input.route.distanceKm < 120
          ? `枢纽至会场约 ${input.route.distanceKm} km / ${input.route.durationMin} 分钟。`
          : `${input.venueReadableAddress || '详见高德地图导航'}`,
      ],
    });
  }

  options.push({
    label: '地铁 / 公交 + 步行',
    lines: [
      `在${dest}乘地铁/公交至会场最近站点，步行或短途打车至「${input.venueTitle}」。`,
      input.transportHints.find((h) => /地铁|公交|线/.test(h)) ??
        '以高德/百度实时公交为准；散场高峰地铁可能限流。',
      '备用网约车，提前查末班车时间。',
    ],
  });

  options.push({
    label: '网约车 / 出租车',
    lines: [
      `从酒店或任意地点打车至「${input.venueTitle}」，高峰约需 40–90 分钟（视路况）。`,
      '散场时段优先滴滴/高德预约，设置好上车点避开拥堵路段。',
      '多人同行可分摊费用，注意核对车牌与平台订单。',
    ],
  });

  if (input.selfDrive) {
    options.push(buildSelfDriveVenueOption(input));
  }

  return dedupeVenueOptions(options).slice(0, 4);
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
