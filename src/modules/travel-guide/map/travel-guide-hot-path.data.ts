import type {
  DrivingRouteSummary,
  GeocodedPlace,
} from './travel-guide-map.types';

/** 交通枢纽 → 场馆 预计算路线（Hot Path，避免实时 direction 调用） */
export interface HotHubRoute {
  hubKey: string;
  hubLabel: string;
  hub: GeocodedPlace;
  /** 出发地别名，用于识别用户输入「宝安机场」「广州南站」等 */
  departureAliases: string[];
  driving: DrivingRouteSummary;
  transitHint?: string;
  walkingHint?: string;
}

/** 常见跨城出发地 → 抵深后接驳枢纽（hubKey 对应 hubRoutes） */
export interface HotInterCityOrigin {
  originLabel: string;
  departureAliases: string[];
  arrivalHubKey: string;
  /** 城际段（高铁/航班等），不含市内地铁 */
  primaryLegHints: string[];
}

export interface HotActivityMapProfile {
  activityLegacyId: number;
  activityCode: string;
  venue: GeocodedPlace;
  /** 逆地理编码后的可读地址（攻略文案用） */
  readableAddress: string;
  hubRoutes: HotHubRoute[];
  interCityOrigins?: HotInterCityOrigin[];
}

/**
 * 热门活动场馆坐标与枢纽路线（风暴 / EDC 等）。
 * 坐标为 WGS84（与高德 Web 服务 GCJ-02 混用时以 hot path 预置值为准）。
 * 路线距离/时长为预估值，用户请求时直接返回，不调用 direction API。
 */
export const TRAVEL_GUIDE_HOT_ACTIVITIES: HotActivityMapProfile[] = [
  {
    activityLegacyId: 4,
    activityCode: 'storm',
    venue: {
      title: '深圳国际会展中心',
      address: '广东省深圳市宝安区福海街道展城路1号',
      lat: 22.7053,
      lng: 113.9396,
    },
    readableAddress:
      '深圳市宝安区·深圳国际会展中心（近福海、沙井，适合风暴电音节接驳）',
    hubRoutes: [
      hubRoute(
        'szx-airport',
        '深圳宝安国际机场',
        {
          title: '深圳宝安国际机场',
          address: '深圳市宝安区',
          lat: 22.6393,
          lng: 113.8106,
        },
        ['宝安机场', '深圳机场', '宝安国际机场', 'SZX'],
        {
          distanceM: 32_000,
          durationSec: 2_700,
          distanceKm: 32,
          durationMin: 45,
        },
        '机场快线/地铁11号线转打车约45–60分钟；深夜到达建议网约车',
      ),
      hubRoute(
        'shenzhen-north',
        '深圳北站',
        {
          title: '深圳北站',
          address: '深圳市龙华区',
          lat: 22.6093,
          lng: 114.0294,
        },
        ['深圳北站', '北站'],
        {
          distanceM: 28_000,
          durationSec: 2_400,
          distanceKm: 28,
          durationMin: 40,
        },
        '地铁4号线转12号线至国展站，或打车约40分钟',
      ),
      hubRoute(
        'guangzhou-south',
        '广州南站',
        {
          title: '广州南站',
          address: '广州市番禺区',
          lat: 22.988,
          lng: 113.269,
        },
        ['广州南站', '广深高铁', '广州南'],
        {
          distanceM: 95_000,
          durationSec: 5_400,
          distanceKm: 95,
          durationMin: 90,
        },
        '广深高铁至深圳北站/福田站后转地铁或打车，建议预留2小时+',
      ),
    ],
    interCityOrigins: [
      interCityOrigin(
        '上海',
        ['上海', '魔都', 'shanghai', '浦东', '虹桥', '上海虹桥', '上海浦东'],
        'shenzhen-north',
        [
          '城际：建议高铁（上海虹桥/上海站 → 深圳北/福田）约 8–10 小时，或航班（浦东/虹桥 → 深圳宝安）约 2.5–3 小时。',
        ],
      ),
      interCityOrigin(
        '北京',
        ['北京', '帝都', 'beijing', '首都机场', '大兴机场'],
        'szx-airport',
        [
          '城际：建议航班（首都/大兴 → 深圳宝安）约 3–3.5 小时，或高铁（北京西 → 深圳北）约 8–10 小时。',
        ],
      ),
      interCityOrigin(
        '杭州',
        ['杭州', '杭州东', '萧山机场'],
        'shenzhen-north',
        [
          '城际：建议高铁（杭州东 → 深圳北）约 6.5–7.5 小时，或航班（萧山 → 宝安）约 2 小时。',
        ],
      ),
      interCityOrigin(
        '成都',
        ['成都', '成都东', '双流', '天府机场'],
        'szx-airport',
        [
          '城际：建议航班（双流/天府 → 深圳宝安）约 2.5–3 小时；高铁耗时较长，可按时间选择。',
        ],
      ),
      interCityOrigin(
        '武汉',
        ['武汉', '汉口', '武汉站', '天河机场'],
        'shenzhen-north',
        [
          '城际：建议高铁（武汉 → 深圳北）约 4.5–5.5 小时，或航班（天河 → 宝安）约 2 小时。',
        ],
      ),
      interCityOrigin('西安', ['西安', '西安北', '咸阳机场'], 'szx-airport', [
        '城际：建议航班（咸阳 → 宝安）约 2.5 小时，或高铁（西安北 → 深圳北）约 9–10 小时。',
      ]),
    ],
  },
  {
    activityLegacyId: 1,
    activityCode: 'tomorrowland',
    venue: {
      title: 'Wisdom Valley Pattaya',
      address: 'Pattaya, Chonburi, Thailand',
      lat: 12.9367,
      lng: 100.8839,
    },
    readableAddress: '泰国芭提雅·Wisdom Valley（Tomorrowland Thailand 主场馆）',
    hubRoutes: [
      hubRoute(
        'utp-airport',
        '乌塔保国际机场',
        {
          title: '乌塔保国际机场',
          address: 'Rayong, Thailand',
          lat: 12.679,
          lng: 101.005,
        },
        ['乌塔保', '乌塔堡', 'UTP', 'U-Tapao', '乌塔保机场'],
        {
          distanceM: 45_000,
          durationSec: 3_600,
          distanceKm: 45,
          durationMin: 60,
        },
        '出租车/包车约45–60分钟；活动日建议提前预约接驳',
      ),
      hubRoute(
        'bkk-airport',
        '曼谷素万那普机场',
        {
          title: '素万那普国际机场',
          address: 'Bangkok, Thailand',
          lat: 13.69,
          lng: 100.75,
        },
        ['曼谷', '素万那普', 'BKK', '曼谷机场', '素万那普机场'],
        {
          distanceM: 120_000,
          durationSec: 7_200,
          distanceKm: 120,
          durationMin: 120,
        },
        '机场大巴至芭提雅后转网约车，或包车约2小时',
      ),
    ],
  },
  {
    activityLegacyId: 5,
    activityCode: 'edc-thailand',
    venue: {
      title: 'Rhythm Park Phuket',
      address: 'Phuket, Thailand',
      lat: 7.96,
      lng: 98.35,
    },
    readableAddress: '泰国普吉岛·Rhythm Park 电音节场地',
    hubRoutes: [
      hubRoute(
        'hkt-airport',
        '普吉国际机场',
        { title: '普吉国际机场', address: 'Phuket', lat: 8.113, lng: 98.317 },
        ['普吉机场', '普吉国际机场', 'HKT'],
        {
          distanceM: 35_000,
          durationSec: 2_700,
          durationMin: 45,
          distanceKm: 35,
        },
        '机场大巴/包车约45–60分钟，活动日建议提前预订接驳',
      ),
    ],
  },
];

export function findHotActivityProfile(
  activityLegacyId: number,
): HotActivityMapProfile | undefined {
  return TRAVEL_GUIDE_HOT_ACTIVITIES.find(
    (a) => a.activityLegacyId === activityLegacyId,
  );
}

export function matchHotInterCityRoute(
  profile: HotActivityMapProfile,
  departureText: string,
): { origin: HotInterCityOrigin; hub: HotHubRoute } | undefined {
  const q = departureText.trim().toLowerCase();
  if (!q || !profile.interCityOrigins?.length) return undefined;

  for (const origin of profile.interCityOrigins) {
    const matched = origin.departureAliases.some(
      (a) =>
        q.includes(a.toLowerCase()) ||
        a.toLowerCase().includes(q) ||
        origin.originLabel.toLowerCase().includes(q),
    );
    if (!matched) continue;

    const hub = profile.hubRoutes.find(
      (h) => h.hubKey === origin.arrivalHubKey,
    );
    if (hub) return { origin, hub };
  }
  return undefined;
}

export function matchHotHubRoute(
  profile: HotActivityMapProfile,
  departureText: string,
): HotHubRoute | undefined {
  const q = departureText.trim().toLowerCase();
  if (!q) return undefined;

  for (const hub of profile.hubRoutes) {
    if (hub.hubLabel.toLowerCase().includes(q)) return hub;
    if (
      hub.departureAliases.some(
        (a) => q.includes(a.toLowerCase()) || a.toLowerCase().includes(q),
      )
    ) {
      return hub;
    }
    if (hub.hub.title.toLowerCase().includes(q)) return hub;
  }
  return undefined;
}

function hubRoute(
  hubKey: string,
  hubLabel: string,
  hub: GeocodedPlace,
  departureAliases: string[],
  driving: DrivingRouteSummary,
  transitHint?: string,
  walkingHint?: string,
): HotHubRoute {
  return {
    hubKey,
    hubLabel,
    hub,
    departureAliases,
    driving,
    transitHint,
    walkingHint,
  };
}

function interCityOrigin(
  originLabel: string,
  departureAliases: string[],
  arrivalHubKey: string,
  primaryLegHints: string[],
): HotInterCityOrigin {
  return { originLabel, departureAliases, arrivalHubKey, primaryLegHints };
}
