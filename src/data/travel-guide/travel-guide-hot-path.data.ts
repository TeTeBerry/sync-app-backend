import type {
  DrivingRouteSummary,
  GeocodedPlace,
} from '@src/modules/travel-guide/map/travel-guide-map.types';

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
    activityLegacyId: 7,
    activityCode: 'tomorrowland-belgium',
    venue: {
      title: 'De Schorre',
      address: 'Schommelei 1, 2850 Boom, Belgium',
      lat: 51.0894,
      lng: 4.3774,
    },
    readableAddress: '比利时 Boom·De Schorre（Tomorrowland Belgium 场地）',
    hubRoutes: [],
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
  {
    activityLegacyId: 8,
    activityCode: 'edc-korea',
    venue: {
      title: 'Inspire Entertainment Resort',
      address: 'Incheon, South Korea',
      lat: 37.466757,
      lng: 126.390594,
    },
    readableAddress:
      '韩国仁川·Inspire Entertainment Resort（永宗岛，近仁川国际机场 ICN）',
    hubRoutes: [
      hubRoute(
        'icn-airport',
        '仁川国际机场',
        {
          title: '仁川国际机场',
          address: 'Incheon, South Korea',
          lat: 37.4602,
          lng: 126.4407,
        },
        ['仁川机场', '仁川国际机场', 'ICN', 'Incheon Airport', '인천공항'],
        {
          distanceM: 12_000,
          durationSec: 1_800,
          durationMin: 30,
          distanceKm: 12,
        },
        'AREX 机场铁路至仁川站转地铁 1 号线永宗方向，或 Kakao T 约 25–40 分钟；活动日建议提前预约接驳',
      ),
      hubRoute(
        'gmp-airport',
        '金浦国际机场',
        {
          title: '金浦国际机场',
          address: 'Seoul, South Korea',
          lat: 37.5583,
          lng: 126.7906,
        },
        ['金浦机场', 'GMP', 'Gimpo'],
        {
          distanceM: 55_000,
          durationSec: 4_200,
          durationMin: 70,
          distanceKm: 55,
        },
        '多用于韩国国内线；国际旅客建议优先飞抵仁川 ICN',
      ),
      hubRoute(
        'incheon-station',
        '仁川站（AREX）',
        {
          title: '仁川站',
          address: 'Incheon, South Korea',
          lat: 37.4764,
          lng: 126.6169,
        },
        ['仁川站', 'AREX', '机场铁路'],
        {
          distanceM: 22_000,
          durationSec: 2_400,
          durationMin: 40,
          distanceKm: 22,
        },
        'AREX 直达仁川机场 T1/T2；转地铁 1 号线往永宗岛方向至会场附近',
      ),
    ],
    interCityOrigins: [
      interCityOrigin(
        '上海',
        ['上海', '魔都', 'shanghai', '浦东', '虹桥', '上海虹桥', '上海浦东'],
        'icn-airport',
        [
          '城际：建议航班（浦东/虹桥 → 仁川 ICN）约 2–2.5 小时；电音节期间提前 2–8 周关注票价。',
        ],
      ),
      interCityOrigin(
        '北京',
        ['北京', '帝都', 'beijing', '首都机场', '大兴机场'],
        'icn-airport',
        [
          '城际：建议航班（首都/大兴 → 仁川 ICN）约 2–2.5 小时；早鸟票量紧俏建议尽早预订。',
        ],
      ),
      interCityOrigin('深圳', ['深圳', '宝安机场', 'SZX'], 'icn-airport', [
        '城际：建议航班（深圳宝安 → 仁川 ICN）约 3.5–4 小时；可经香港/上海中转比价。',
      ]),
      interCityOrigin('广州', ['广州', '白云', 'CAN'], 'icn-airport', [
        '城际：建议航班（广州白云 → 仁川 ICN）约 3.5–4 小时；活动周房价与机票波动大。',
      ]),
      interCityOrigin('杭州', ['杭州', '萧山', 'HGH'], 'icn-airport', [
        '城际：建议航班（萧山 → 仁川 ICN）约 2–2.5 小时；或高铁至上海后飞 ICN。',
      ]),
      interCityOrigin(
        '成都',
        ['成都', '双流', '天府', 'CTU', 'TFU'],
        'icn-airport',
        [
          '城际：建议航班（双流/天府 → 仁川 ICN）约 3–3.5 小时；留意直飞与经停时刻。',
        ],
      ),
    ],
  },
  {
    activityLegacyId: 3,
    activityCode: 's2o',
    venue: {
      title: 'Seoul Land',
      address: 'Gwacheon, Gyeonggi, South Korea',
      lat: 37.421,
      lng: 126.9893,
    },
    readableAddress:
      '韩国首尔·首尔乐园 Seoul Land（果川，地铁 4 号线首尔大公园站）',
    hubRoutes: [
      hubRoute(
        'icn-airport',
        '仁川国际机场',
        {
          title: '仁川国际机场',
          address: 'Incheon, South Korea',
          lat: 37.4602,
          lng: 126.4407,
        },
        ['仁川机场', '仁川国际机场', 'ICN', 'Incheon Airport', '인천공항'],
        {
          distanceM: 58_000,
          durationSec: 5_400,
          durationMin: 90,
          distanceKm: 58,
        },
        'AREX 至首尔站转地铁 4 号线至首尔大公园站，或 Kakao T 约 70–90 分钟；活动日建议提前预约接驳',
      ),
      hubRoute(
        'gmp-airport',
        '金浦国际机场',
        {
          title: '金浦国际机场',
          address: 'Seoul, South Korea',
          lat: 37.5583,
          lng: 126.7906,
        },
        ['金浦机场', 'GMP', 'Gimpo'],
        {
          distanceM: 28_000,
          durationSec: 3_000,
          durationMin: 50,
          distanceKm: 28,
        },
        '机场铁路或 Kakao T 约 40–60 分钟；国际旅客仍建议优先飞抵仁川 ICN',
      ),
      hubRoute(
        'seoul-station',
        '首尔站',
        {
          title: '首尔站',
          address: 'Seoul, South Korea',
          lat: 37.5547,
          lng: 126.9707,
        },
        ['首尔站', 'Seoul Station', '首尔'],
        {
          distanceM: 18_000,
          durationSec: 2_400,
          durationMin: 40,
          distanceKm: 18,
        },
        '地铁 4 号线至首尔大公园站，再步行或园区接驳至首尔乐园会场',
      ),
    ],
    interCityOrigins: [
      interCityOrigin(
        '上海',
        ['上海', '魔都', 'shanghai', '浦东', '虹桥', '上海虹桥', '上海浦东'],
        'icn-airport',
        [
          '城际：建议航班（浦东/虹桥 → 仁川 ICN）约 2–2.5 小时；电音节期间提前 2–8 周关注票价。',
        ],
      ),
      interCityOrigin(
        '北京',
        ['北京', '帝都', 'beijing', '首都机场', '大兴机场'],
        'icn-airport',
        [
          '城际：建议航班（首都/大兴 → 仁川 ICN）约 2–2.5 小时；早鸟票量紧俏建议尽早预订。',
        ],
      ),
      interCityOrigin('深圳', ['深圳', '宝安机场', 'SZX'], 'icn-airport', [
        '城际：建议航班（深圳宝安 → 仁川 ICN）约 3.5–4 小时；可经香港/上海中转比价。',
      ]),
      interCityOrigin('广州', ['广州', '白云', 'CAN'], 'icn-airport', [
        '城际：建议航班（广州白云 → 仁川 ICN）约 3.5–4 小时；活动周房价与机票波动大。',
      ]),
      interCityOrigin('杭州', ['杭州', '萧山', 'HGH'], 'icn-airport', [
        '城际：建议航班（萧山 → 仁川 ICN）约 2–2.5 小时；或高铁至上海后飞 ICN。',
      ]),
      interCityOrigin(
        '成都',
        ['成都', '双流', '天府', 'CTU', 'TFU'],
        'icn-airport',
        [
          '城际：建议航班（双流/天府 → 仁川 ICN）约 3–3.5 小时；留意直飞与经停时刻。',
        ],
      ),
    ],
  },
  {
    activityLegacyId: 6,
    activityCode: 'world-dj-festival',
    venue: {
      title: '海の森水上競技場',
      address: 'Tokyo, Japan',
      lat: 35.6348,
      lng: 139.7945,
    },
    readableAddress: '日本东京·海の森水上競技場（东京湾临海区域）',
    hubRoutes: [
      hubRoute(
        'hnd-airport',
        '羽田国际机场',
        {
          title: '羽田国际机场',
          address: 'Tokyo, Japan',
          lat: 35.5494,
          lng: 139.7798,
        },
        ['羽田机场', '羽田国际机场', 'HND', 'Haneda'],
        {
          distanceM: 12_000,
          durationSec: 1_800,
          durationMin: 30,
          distanceKm: 12,
        },
        '京急线至品川转临海线，或 Monorail/出租车约 25–40 分钟；活动日建议提前预约接驳',
      ),
      hubRoute(
        'nrt-airport',
        '成田国际机场',
        {
          title: '成田国际机场',
          address: 'Narita, Japan',
          lat: 35.772,
          lng: 140.3929,
        },
        ['成田机场', '成田国际机场', 'NRT', 'Narita'],
        {
          distanceM: 75_000,
          durationSec: 5_400,
          durationMin: 90,
          distanceKm: 75,
        },
        "成田特快 N'EX 至东京站再转地铁/临海线，约 60–90 分钟",
      ),
      hubRoute(
        'tokyo-station',
        '东京站',
        {
          title: '东京站',
          address: 'Tokyo, Japan',
          lat: 35.6812,
          lng: 139.7671,
        },
        ['东京站', 'Tokyo Station', '东京'],
        {
          distanceM: 10_000,
          durationSec: 1_500,
          durationMin: 25,
          distanceKm: 10,
        },
        'JR 山手线至新桥/品川后转临海线，或会场 Shuttle 接驳',
      ),
    ],
    interCityOrigins: [
      interCityOrigin(
        '上海',
        ['上海', '魔都', 'shanghai', '浦东', '虹桥', '上海虹桥', '上海浦东'],
        'hnd-airport',
        [
          '城际：建议航班（浦东/虹桥 → 羽田 HND）约 2.5–3 小时；成田 NRT 备选，电音节期间提前 2–8 周关注票价。',
        ],
      ),
      interCityOrigin(
        '北京',
        ['北京', '帝都', 'beijing', '首都机场', '大兴机场'],
        'hnd-airport',
        [
          '城际：建议航班（首都/大兴 → 羽田 HND）约 3–3.5 小时；早鸟票量紧俏建议尽早预订。',
        ],
      ),
      interCityOrigin('深圳', ['深圳', '宝安机场', 'SZX'], 'hnd-airport', [
        '城际：建议航班（深圳宝安 → 羽田 HND）约 3.5–4 小时；可经上海/香港中转比价。',
      ]),
      interCityOrigin('广州', ['广州', '白云', 'CAN'], 'hnd-airport', [
        '城际：建议航班（广州白云 → 羽田 HND）约 3.5–4 小时；活动周房价与机票波动大。',
      ]),
      interCityOrigin('杭州', ['杭州', '萧山', 'HGH'], 'hnd-airport', [
        '城际：建议航班（萧山 → 羽田 HND）约 2.5–3 小时；或高铁至上海后飞 HND。',
      ]),
      interCityOrigin(
        '成都',
        ['成都', '双流', '天府', 'CTU', 'TFU'],
        'hnd-airport',
        [
          '城际：建议航班（双流/天府 → 羽田 HND）约 4–4.5 小时；留意直飞与经停时刻。',
        ],
      ),
    ],
  },
  {
    activityLegacyId: 11,
    activityCode: 'ultra-japan',
    venue: {
      title: 'Odaiba Ultra Park',
      address: 'Odaiba, Tokyo, Japan',
      lat: 35.6258,
      lng: 139.7751,
    },
    readableAddress: '日本东京·台场（お台場，临海线台场/东京 Teleport 站）',
    hubRoutes: [
      hubRoute(
        'hnd-airport',
        '羽田国际机场',
        {
          title: '羽田国际机场',
          address: 'Tokyo, Japan',
          lat: 35.5494,
          lng: 139.7798,
        },
        ['羽田机场', '羽田国际机场', 'HND', 'Haneda'],
        {
          distanceM: 15_000,
          durationSec: 2_100,
          durationMin: 35,
          distanceKm: 15,
        },
        'Monorail 至滨松町转临海线至台场站，或出租车约 25–40 分钟',
      ),
      hubRoute(
        'nrt-airport',
        '成田国际机场',
        {
          title: '成田国际机场',
          address: 'Narita, Japan',
          lat: 35.772,
          lng: 140.3929,
        },
        ['成田机场', '成田国际机场', 'NRT', 'Narita'],
        {
          distanceM: 78_000,
          durationSec: 5_400,
          durationMin: 90,
          distanceKm: 78,
        },
        "成田特快 N'EX 至东京站再转临海线至台场，约 70–90 分钟",
      ),
      hubRoute(
        'tokyo-station',
        '东京站',
        {
          title: '东京站',
          address: 'Tokyo, Japan',
          lat: 35.6812,
          lng: 139.7671,
        },
        ['东京站', 'Tokyo Station', '东京'],
        {
          distanceM: 12_000,
          durationSec: 1_800,
          durationMin: 30,
          distanceKm: 12,
        },
        'JR 山手线至新桥转临海线至台场站，步行或短驳至会场',
      ),
    ],
    interCityOrigins: [
      interCityOrigin(
        '上海',
        ['上海', '魔都', 'shanghai', '浦东', '虹桥', '上海虹桥', '上海浦东'],
        'hnd-airport',
        [
          '城际：建议航班（浦东/虹桥 → 羽田 HND）约 2.5–3 小时；成田 NRT 备选，电音节期间提前 2–8 周关注票价。',
        ],
      ),
      interCityOrigin(
        '北京',
        ['北京', '帝都', 'beijing', '首都机场', '大兴机场'],
        'hnd-airport',
        [
          '城际：建议航班（首都/大兴 → 羽田 HND）约 3–3.5 小时；早鸟票量紧俏建议尽早预订。',
        ],
      ),
      interCityOrigin('深圳', ['深圳', '宝安机场', 'SZX'], 'hnd-airport', [
        '城际：建议航班（深圳宝安 → 羽田 HND）约 3.5–4 小时；可经上海/香港中转比价。',
      ]),
      interCityOrigin('广州', ['广州', '白云', 'CAN'], 'hnd-airport', [
        '城际：建议航班（广州白云 → 羽田 HND）约 3.5–4 小时；活动周房价与机票波动大。',
      ]),
      interCityOrigin('杭州', ['杭州', '萧山', 'HGH'], 'hnd-airport', [
        '城际：建议航班（萧山 → 羽田 HND）约 2.5–3 小时；或高铁至上海后飞 HND。',
      ]),
      interCityOrigin(
        '成都',
        ['成都', '双流', '天府', 'CTU', 'TFU'],
        'hnd-airport',
        [
          '城际：建议航班（双流/天府 → 羽田 HND）约 4–4.5 小时；留意直飞与经停时刻。',
        ],
      ),
    ],
  },
  {
    activityLegacyId: 16,
    activityCode: 'tomorrowland-shanghai',
    venue: {
      title: '外滩大会新址科技展馆',
      address: '上海市黄浦区龙华东路130号',
      lat: 31.1906,
      lng: 121.4842,
    },
    readableAddress:
      '上海市黄浦区·外滩大会新址科技展馆（龙华东路130号，近世博会博物馆站）',
    hubRoutes: [
      hubRoute(
        'expo-museum-metro',
        '世博会博物馆站',
        {
          title: '世博会博物馆站',
          address: '上海市黄浦区蒙自路',
          lat: 31.1853,
          lng: 121.4818,
        },
        ['世博会博物馆', '世博博物馆', '13号线世博博物馆'],
        {
          distanceM: 800,
          durationSec: 600,
          distanceKm: 0.8,
          durationMin: 10,
        },
        '地铁13号线世博会博物馆站步行约8–12分钟至场馆',
      ),
      hubRoute(
        'shanghai-hongqiao-rail',
        '上海虹桥站',
        {
          title: '上海虹桥站',
          address: '上海市闵行区',
          lat: 31.1949,
          lng: 121.3202,
        },
        ['上海虹桥站', '虹桥站', '虹桥火车站'],
        {
          distanceM: 18_000,
          durationSec: 2_100,
          distanceKm: 18,
          durationMin: 35,
        },
        '地铁10号线转13号线至世博会博物馆站，或打车约30–40分钟',
      ),
      hubRoute(
        'sha-airport',
        '上海虹桥国际机场',
        {
          title: '上海虹桥国际机场',
          address: '上海市长宁区',
          lat: 31.1979,
          lng: 121.3364,
        },
        ['虹桥机场', '上海虹桥', 'SHA'],
        {
          distanceM: 20_000,
          durationSec: 2_400,
          distanceKm: 20,
          durationMin: 40,
        },
        '地铁10号线转13号线，或网约车约35–50分钟',
      ),
      hubRoute(
        'pvg-airport',
        '上海浦东国际机场',
        {
          title: '上海浦东国际机场',
          address: '上海市浦东新区',
          lat: 31.1443,
          lng: 121.8083,
        },
        ['浦东机场', '上海浦东', 'PVG'],
        {
          distanceM: 45_000,
          durationSec: 3_600,
          distanceKm: 45,
          durationMin: 60,
        },
        '地铁2号线转13号线，或磁浮+地铁约70–90分钟',
      ),
      hubRoute(
        'shanghai-rail',
        '上海站',
        {
          title: '上海站',
          address: '上海市静安区',
          lat: 31.2496,
          lng: 121.4558,
        },
        ['上海站', '上海火车站'],
        {
          distanceM: 8_500,
          durationSec: 1_500,
          distanceKm: 8.5,
          durationMin: 25,
        },
        '地铁1号线转13号线，或打车约20–30分钟',
      ),
    ],
    interCityOrigins: [
      interCityOrigin(
        '深圳',
        ['深圳', '宝安机场', 'SZX', '深圳北站'],
        'sha-airport',
        [
          '城际：建议航班（深圳宝安 → 上海虹桥/浦东）约 2.5–3 小时，或高铁（深圳北 → 上海虹桥）约 7–8 小时。',
        ],
      ),
      interCityOrigin(
        '北京',
        ['北京', '首都机场', '大兴机场', 'PEK', 'PKX'],
        'pvg-airport',
        [
          '城际：建议航班（首都/大兴 → 上海虹桥/浦东）约 2–2.5 小时；高铁至上海虹桥约 4.5–5.5 小时。',
        ],
      ),
      interCityOrigin(
        '广州',
        ['广州', '白云', 'CAN', '广州南'],
        'sha-airport',
        [
          '城际：建议航班（广州白云 → 上海虹桥/浦东）约 2.5 小时，或高铁（广州南 → 上海虹桥）约 7 小时。',
        ],
      ),
      interCityOrigin(
        '杭州',
        ['杭州', '萧山', 'HGH', '杭州东'],
        'shanghai-hongqiao-rail',
        [
          '城际：建议高铁（杭州东 → 上海虹桥）约 1 小时，或航班（萧山 → 虹桥/浦东）约 1 小时。',
        ],
      ),
      interCityOrigin(
        '成都',
        ['成都', '双流', '天府', 'CTU', 'TFU'],
        'pvg-airport',
        ['城际：建议航班（双流/天府 → 上海虹桥/浦东）约 2.5–3 小时。'],
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
