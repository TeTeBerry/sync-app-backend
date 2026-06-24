import type { Activity } from '../../../database/schemas/activity.schema';
import type { TravelGuideTicketChannel } from '@sync/travel-guide-contracts';
import { destinationCityFromActivityLocation } from '../map/travel-guide-intercity.util';

const DOMESTIC_TICKET_CHANNEL_PATTERN = /大麦|猫眼|小程序|公众号|微信/i;

type TravelGuideTicketActivity = Pick<
  Activity,
  'name' | 'location' | 'region' | 'externalUrl' | 'code'
>;

const OVERSEAS_TICKET_CHANNELS_BY_CODE: Record<
  string,
  TravelGuideTicketChannel[]
> = {
  'world-dj-festival': [
    {
      name: 'World DJ Festival 官网',
      note: 'https://worlddjfestival-jp.com — 早鸟与通票通常最先释出，电子票邮件发送。',
    },
    {
      name: 'ZAIKO / e+',
      note: '日本大型音乐节常用第三方，支持海外信用卡；购票后保留确认邮件与二维码截图。',
    },
  ],
  'ultra-europe': [
    {
      name: 'Ultra Europe 官网',
      note: 'https://ultraeurope.com — 官方售票与 Split / Hvar / Brač 套票。',
    },
    {
      name: 'Eventim',
      note: '欧洲场常用授权票务伙伴，支持电子票；认准 Ultra 官方跳转链接。',
    },
  ],
  'edc-orlando': [
    {
      name: 'EDC Orlando 官网（Insomniac）',
      note: 'https://orlando.edc.com — 官方售票、Payment Plan 与 Shuttle 加购。',
    },
    {
      name: 'Front Gate Tickets',
      note: 'Insomniac 美场常用票务伙伴；电子票绑定 Insomniac 账户，入场前完成实名/绑定。',
    },
  ],
  'edc-korea': [
    {
      name: 'EDC Korea 官网',
      note: 'https://korea.edc.com/en/ — 韩国场官方售票与 Shuttle 套票。',
    },
    {
      name: 'Melon Ticket / YES24',
      note: '韩国大型音乐节常用授权平台；支持海外信用卡，购票后保留确认邮件。',
    },
  ],
  'edc-thailand': [
    {
      name: 'EDC Thailand 官网',
      note: 'https://thailand.edc.com — 官方售票与 Shuttle 接驳套票。',
    },
    {
      name: 'Klook',
      note: '泰国场常用官方合作渠道，含接驳/酒店套票选项；认准 EDC 官方合作标识。',
    },
  ],
  'ultra-japan': [
    {
      name: 'Ultra Japan 官网',
      note: 'https://ultrajapan.com — 官方售票与早鸟释出时间以官网公告为准。',
    },
    {
      name: 'ZAIKO / e+',
      note: '日本 Ultra 系列常用第三方，支持海外信用卡；电子票邮件发送，入场前截图保存。',
    },
  ],
  'tomorrowland-belgium': [
    {
      name: 'Tomorrowland 官网',
      note: 'https://www.tomorrowland.com — 全球销售窗口与注册抽签以官网公告为准。',
    },
    {
      name: 'Paylogic',
      note: 'Tomorrowland 官方票务伙伴；须完成 Global Journey 或门票注册流程。',
    },
  ],
  tomorrowland: [
    {
      name: 'Tomorrowland Thailand 官网',
      note: 'https://thailand.tomorrowland.com — 泰国场官方售票与套餐信息。',
    },
    {
      name: 'Klook',
      note: '泰国场常用官方合作渠道，含接驳/酒店套票；认准 Tomorrowland 官方合作标识。',
    },
  ],
  s2o: [
    {
      name: 'S2O Korea 官网',
      note: 'https://www.s2okorea.com — 韩国场官方售票与早鸟信息。',
    },
    {
      name: 'Melon Ticket / YES24',
      note: '韩国大型水上音乐节常用授权平台；电子票二维码提前截图保存。',
    },
  ],
  defqon1: [
    {
      name: 'Defqon.1 官网',
      note: 'https://www.defqon1.nl — 荷兰场官方售票与露营套票。',
    },
    {
      name: 'Paylogic',
      note: 'Q-dance 旗下活动常用票务伙伴；电子票绑定账户，勿通过非官方二手平台购票。',
    },
  ],
  'untold-romania': [
    {
      name: 'UNTOLD Festival 官网',
      note: 'https://untold.com — 罗马尼亚场官方售票与多日通票。',
    },
    {
      name: 'Eventim',
      note: '欧洲大型音乐节常用授权伙伴；认准 UNTOLD 官方跳转链接。',
    },
  ],
  'untold-dubai': [
    {
      name: 'UNTOLD Dubai 官网',
      note: 'https://untold.com/ — 迪拜场官方售票与套餐信息。',
    },
    {
      name: 'Platinumlist / Ticketmaster UAE',
      note: '中东场常用授权票务伙伴；电子票邮件发送，入境前完成账户绑定。',
    },
  ],
  creamfields: [
    {
      name: 'Creamfields 官网',
      note: 'https://www.creamfields.com — 英国场官方售票与露营套票。',
    },
    {
      name: 'See Tickets',
      note: '英国音乐节常用授权伙伴；支持电子票，认准 Creamfields 官方跳转。',
    },
  ],
  soundstorm: [
    {
      name: 'MDLBEAST Soundstorm 官网',
      note: 'https://www.mdlbeast.com/soundstorm — 沙特场官方售票与 VIP 套餐。',
    },
    {
      name: 'WeBook',
      note: '沙特大型活动常用票务平台；支持电子票，购票后保留确认邮件。',
    },
  ],
};

const DOMESTIC_ACTIVITY_CODES = new Set(['storm', 'tomorrowland-shanghai']);

export type TravelGuideRegionKind = 'domestic' | 'overseas' | 'hmt';

type TravelGuideRegionActivity = Pick<
  Activity,
  'region' | 'name' | 'location' | 'code'
>;

function inferTravelGuideRegionKind(
  activity: Partial<TravelGuideRegionActivity>,
): TravelGuideRegionKind | null {
  const code = activity.code?.trim();
  if (code && DOMESTIC_ACTIVITY_CODES.has(code)) return 'domestic';
  if (code && code in OVERSEAS_TICKET_CHANNELS_BY_CODE) return 'overseas';

  const corpus = overseasCorpus(activity);
  if (/香港|澳门|台湾|hong kong|macau|taipei|台北/.test(corpus)) return 'hmt';
  if (
    isThailandOverseasCorpus(corpus) ||
    isKoreaOverseasCorpus(corpus) ||
    isJapanOverseasCorpus(corpus) ||
    /荷兰|比利时|克罗地亚|美国|奥兰多|罗马尼亚|迪拜|沙特|英国|比丁赫伊普|walibi|split|斯普利特/.test(
      corpus,
    )
  ) {
    return 'overseas';
  }

  return null;
}

export function travelGuideRegionKind(
  activity: Partial<TravelGuideRegionActivity>,
): TravelGuideRegionKind {
  const region = activity.region?.trim();
  if (region === 'overseas' || region === 'hmt') return region;

  const inferred = inferTravelGuideRegionKind(activity);
  if (inferred) return inferred;

  return 'domestic';
}

export function isTravelGuideAbroad(
  activity: Partial<TravelGuideRegionActivity>,
): boolean {
  return travelGuideRegionKind(activity) !== 'domestic';
}

function genericOverseasTicketChannels(
  activity: TravelGuideTicketActivity,
): TravelGuideTicketChannel[] {
  const channels: TravelGuideTicketChannel[] = [];

  if (activity.externalUrl?.trim()) {
    channels.push({
      name: '官方购票链接',
      note: activity.externalUrl.trim(),
    });
  } else {
    channels.push({
      name: `${activity.name} 官网`,
      note: '请搜索活动英文名 + official tickets，认准主办方官网域名。',
    });
  }

  channels.push(
    {
      name: '官方授权票务伙伴',
      note: 'Ticketmaster / Eventim / See Tickets 等（以官网跳转为准）；勿通过非官方二手平台购票。',
    },
    {
      name: 'Klook / Trip.com',
      note: '部分境外场提供官方合作套票（含接驳/酒店），价格可能略高于官网；认准官方合作标识。',
    },
  );

  return channels.slice(0, 4);
}

function hmtTicketChannels(
  activity: TravelGuideTicketActivity,
): TravelGuideTicketChannel[] {
  const channels: TravelGuideTicketChannel[] = [];

  if (activity.externalUrl?.trim()) {
    channels.push({
      name: '官方购票链接',
      note: activity.externalUrl.trim(),
    });
  }

  channels.push(
    {
      name: '活动官网 / 主办方公告',
      note: '港澳台场以主办方官网或公告为准；早鸟与实名规则以购票页说明为准。',
    },
    {
      name: 'Klook / Trip.com / 携程',
      note: '港澳台大型活动常用 OTA 合作渠道；认准官方合作或主办方授权标识。',
    },
    {
      name: 'Cityline / HK Ticketing（香港场）',
      note: '香港演唱会/音乐节常用票务平台；台湾场可关注 KKTIX / ibon 等本地授权渠道。',
    },
  );

  return channels.slice(0, 4);
}

function domesticTicketChannels(
  activity: TravelGuideTicketActivity,
): TravelGuideTicketChannel[] {
  const channels: TravelGuideTicketChannel[] = [];

  if (activity.externalUrl?.trim()) {
    channels.push({
      name: '官方购票链接',
      note: activity.externalUrl.trim(),
    });
  }

  channels.push(
    {
      name: '大麦 / 猫眼',
      note: '国内大型电音节常用官方授权渠道，支持电子票与实名制。',
    },
    {
      name: '活动官方小程序 / 公众号',
      note: '搜索活动全名，认准官方认证；早鸟与组合票通常最先释出。',
    },
  );

  return channels;
}

export function buildTravelGuideTicketChannels(
  activity: TravelGuideTicketActivity,
): TravelGuideTicketChannel[] {
  const kind = travelGuideRegionKind(activity);

  if (kind === 'domestic') {
    return domesticTicketChannels(activity);
  }

  if (kind === 'hmt') {
    return hmtTicketChannels(activity);
  }

  const code = activity.code?.trim();
  if (code && OVERSEAS_TICKET_CHANNELS_BY_CODE[code]) {
    return OVERSEAS_TICKET_CHANNELS_BY_CODE[code];
  }

  return genericOverseasTicketChannels(activity);
}

/** Strip domestic-only ticket channels when LLM polish returns invalid overseas entries. */
export function sanitizeTicketChannelsForActivity(
  channels: TravelGuideTicketChannel[] | undefined,
  activity: TravelGuideTicketActivity,
): TravelGuideTicketChannel[] {
  const fallback = buildTravelGuideTicketChannels(activity);
  if (!channels?.length) return fallback;
  if (!isTravelGuideAbroad(activity)) return channels;

  const hasDomesticLeak = channels.some((ch) =>
    DOMESTIC_TICKET_CHANNEL_PATTERN.test(`${ch.name} ${ch.note}`),
  );
  if (hasDomesticLeak) return fallback;

  return channels;
}

/** 境外/港澳台酒店预订渠道 */
export const ABROAD_HOTEL_BOOKING_HINT = '携程 / Agoda / Booking / Airbnb';

export function travelGuideHotelBookingHint(
  activity: Pick<Activity, 'region'>,
): string {
  return isTravelGuideAbroad(activity)
    ? ABROAD_HOTEL_BOOKING_HINT
    : '携程 / 美团';
}

function overseasCorpus(
  activity: Partial<Pick<Activity, 'name' | 'location' | 'region'>>,
  destinationCity?: string,
): string {
  const dest =
    destinationCity?.trim() ||
    destinationCityFromActivityLocation(activity.location) ||
    '';
  return `${activity.name ?? ''} ${activity.location ?? ''} ${dest}`.toLowerCase();
}

export function isThailandOverseasCorpus(corpus: string): boolean {
  return /泰国|thailand|普吉|phuket|曼谷|bangkok|芭提雅|pattaya/.test(corpus);
}

export function isKoreaOverseasCorpus(corpus: string): boolean {
  return /韩国|korea|仁川|incheon|首尔|seoul|永宗|yeongjong|edckorea|edc korea|s2o/.test(
    corpus,
  );
}

export function isJapanOverseasCorpus(corpus: string): boolean {
  return /日本|japan|东京|tokyo|台场|odaiba|海の森|羽田|haneda|成田|narita|wdjf|ultra japan|有明|ariake/.test(
    corpus,
  );
}

export function buildTravelGuideDocumentItems(input: {
  activity: Pick<Activity, 'name' | 'location' | 'region'>;
  destinationCity?: string;
}): string[] {
  const kind = travelGuideRegionKind(input.activity);
  const dest =
    input.destinationCity?.trim() ||
    destinationCityFromActivityLocation(input.activity.location) ||
    '目的地';

  if (kind === 'hmt') {
    return [
      '港澳通行证 / 台湾通行证（有效签注），大陆居民赴港澳台必备。',
      '身份证原件，口岸与酒店登记可能抽查。',
      '返程交通票据（高铁/航班），部分口岸可能核验行程。',
      '境外漫游或当地 eSIM；港澳可开通漫游包，台湾建议提前购卡。',
      '少量港币/澳门元/新台币现金 + 银联/Visa 卡，部分小店仅收现金。',
    ];
  }

  if (kind === 'overseas') {
    const lower = overseasCorpus(input.activity, input.destinationCity);
    const thailand = isThailandOverseasCorpus(lower);
    const korea = isKoreaOverseasCorpus(lower);
    const japan = isJapanOverseasCorpus(lower);

    const base = [
      '护照原件（建议有效期 6 个月以上，留 2 页以上空白页）。',
      thailand
        ? '泰国签证：持有效护照可享免签/落地签政策（以入境当日官方为准），建议打印返程机票与酒店订单备查。'
        : korea
          ? '韩国入境：请提前确认签证/K-ETA 资格（以入境当日韩国官方为准）；打印返程机票与酒店预订单备查。'
          : japan
            ? '日本入境：请提前完成 Visit Japan Web 入境审查（如适用）与海关申报；打印返程机票与酒店预订单备查。'
            : '签证/入境许可：按目的地要求提前办理电子签/落地签，打印酒店与返程行程单。',
      '返程机票行程单 + 酒店预订单（海关/入境可能抽查）。',
      '国际旅行保险（含医疗与行程变更，电音节现场建议覆盖）。',
      '常用药品与个人证件复印件（与原件分开放置）。',
    ];

    if (thailand) {
      base.push(
        '泰铢现金（落地签费、小费、夜市/摊位常用）+ Visa/Master 卡备用。',
        '泰国电话卡/eSIM（Grab、Bolt 叫车与导航必备）。',
      );
    } else if (korea) {
      base.push(
        '韩元现金 + T-money 交通卡（地铁/便利店可用）；Visa/Master 卡用于酒店预授权。',
        '韩国电话卡/eSIM（Kakao T 叫车、Naver Map 导航必备）。',
      );
    } else if (japan) {
      base.push(
        '日元现金 + Suica/Pasmo 交通卡（地铁/便利店可用）；Visa/Master 卡用于酒店预授权。',
        '日本电话卡/eSIM（Google Maps / Navitime 导航、Uber Japan 叫车必备）。',
      );
    } else {
      base.push(
        '目的地货币现金 + 国际信用卡；提前了解小费/刷卡习惯。',
        '当地电话卡或 eSIM，便于叫车、导航与紧急联系。',
      );
    }

    return base;
  }

  return [];
}

export function buildTravelGuideEssentials(input: {
  activity: Pick<Activity, 'name' | 'location' | 'region'>;
  destinationCity?: string;
  interCity: boolean;
}): {
  network: string[];
  payment: string[];
  apps: string[];
} {
  const kind = travelGuideRegionKind(input.activity);
  const dest =
    input.destinationCity?.trim() ||
    destinationCityFromActivityLocation(input.activity.location) ||
    '目的地';

  if (kind === 'overseas') {
    const lower = overseasCorpus(input.activity, input.destinationCity);
    const thailand = isThailandOverseasCorpus(lower);
    const korea = isKoreaOverseasCorpus(lower);
    const japan = isJapanOverseasCorpus(lower);

    return {
      network: [
        thailand
          ? 'AIS/TrueMove 电话卡或 eSIM，机场/711 可购；国内可提前淘宝/eSIM 平台订购。'
          : korea
            ? '韩国 LG U+ / SKT / KT 电话卡或 eSIM，仁川机场柜位即买即用；提前下载 Naver Map 离线包。'
            : japan
              ? '日本 docomo / SoftBank / au 电话卡或 eSIM，羽田/成田柜位即买即用；提前下载 Google Maps 离线包。'
              : '目的地 eSIM/当地 SIM，活动场馆与郊区信号可能较弱，建议下载离线地图。',
        '国际漫游包可作备用，但现场刷票/叫车更依赖当地网络。',
        '场馆内 Wi‑Fi 不稳定，关键信息（票夹、行程）建议截图保存。',
      ],
      payment: [
        thailand
          ? '泰铢现金必备（落地签、夜市、小摊）；7‑Eleven / 商场可支付宝/微信部分商户。'
          : korea
            ? '韩元现金 + T-money 卡（地铁/公交/便利店）；大型商场与酒店可刷卡，小摊多现金。'
            : japan
              ? '日元现金 + Suica/Pasmo 卡（地铁/公交/便利店）；大型商场与酒店可刷卡，小摊多现金。'
              : '当地货币现金 + Visa/Master；国内移动支付覆盖有限，勿仅依赖微信/支付宝。',
        '备 1–2 张国际信用卡用于酒店预授权与紧急支出。',
        '小额美元现金可作应急，汇率一般不如当地货币。',
      ],
      apps: thailand
        ? [
            'Grab / Bolt：泰国主流网约车，散场叫车首选。',
            'Google Maps：导航与周边 POI；国内可先下载离线包。',
            'Klook / 官方购票 App：门票与 Shuttle 接驳。',
            '翻译 App（Google/有道）+ 汇率换算，沟通与记账更方便。',
          ]
        : korea
          ? [
              'Kakao T：韩国主流网约车，散场叫车首选。',
              'Naver Map / Google Maps：导航与周边 POI；仁川/首尔建议 Naver 为主。',
              'Subway Korea / Kakao Metro：地铁与 AREX 机场铁路查询。',
              'Papago 翻译 + 官方购票 App / 邮件票夹，入场二维码提前截图。',
            ]
          : japan
            ? [
                'Uber Japan / Japan Taxi：散场叫车首选；高峰建议提前预约。',
                'Google Maps / Navitime：导航与周边 POI；东京建议 Navitime 查换乘。',
                '山手线 / 东京 Metro / 临海线：会场周边轨道交通查询。',
                'Google 翻译 + 官方购票 App / 邮件票夹，入场二维码提前截图。',
              ]
            : [
                'Google Maps / Apple Maps：导航与公共交通。',
                '当地网约车 App（如 Grab、Uber 等，按目的地选择）。',
                '官方购票 App / 邮件票夹，入场二维码提前截图。',
                '翻译 + 汇率 App，入境与消费更省心。',
              ],
    };
  }

  if (kind === 'hmt') {
    return {
      network: [
        '开通港澳台漫游包或购买当地 SIM/eSIM；微信/支付宝在港澳部分场景可用。',
        '台湾建议提前购中华电信/远传等预付卡，机场柜位即买即用。',
        '场馆与地下信号可能弱，行程与票夹信息请截图。',
      ],
      payment: [
        '港币/澳门元/新台币现金 + 银联/Visa；八达通（香港）可覆盖地铁与小商户。',
        '微信/支付宝在港澳覆盖较广，台湾仍以现金与信用卡为主。',
        '备少量零钱乘公交、便利店与小吃摊。',
      ],
      apps: [
        '高德/百度/Apple Maps：港澳导航；台湾可用 Google Maps。',
        'MTR Mobile / 澳门巴士 App / 台湾高铁 App（按目的地）。',
        'Klook/携程/官方购票渠道查票；Uber/本地网约车视城市而定。',
        '支付宝境外乘车码（港澳部分线路支持）。',
      ],
    };
  }

  const network = [
    `${dest}活动日场馆周边可能拥堵，建议提前下载离线地图包。`,
    '移动/联通/电信漫游或本地流量包均可；散场时段网络可能拥塞，关键信息截图保存。',
  ];
  if (input.interCity) {
    network.push(
      '跨城出行：高铁/机场 Wi‑Fi 可用于接收接驳信息，但勿依赖场内信号购票。',
    );
  }

  return {
    network,
    payment: [
      '微信/支付宝覆盖大部分餐饮与网约车；备 200–500 元零钱应对小摊与临时支出。',
      '银联卡可用于酒店押金；部分境外卡通道在 OTA 订房更稳。',
      '散场夜宵与打车高峰，提前确保支付 App 余额或绑卡正常。',
    ],
    apps: [
      '高德地图 / 百度地图：驾车、公交与周边 POI。',
      '铁路 12306 / 航旅纵横 / 携程：城际票与航班动态。',
      '滴滴 / 高德打车：散场网约车；高峰建议提前预约。',
      '大麦 / 官方小程序：门票与入场二维码；截图防丢。',
    ],
  };
}
