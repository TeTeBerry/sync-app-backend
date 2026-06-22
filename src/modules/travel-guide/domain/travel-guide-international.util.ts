import type { Activity } from '../../../database/schemas/activity.schema';
import { destinationCityFromActivityLocation } from '../map/travel-guide-intercity.util';

export type TravelGuideRegionKind = 'domestic' | 'overseas' | 'hmt';

export function travelGuideRegionKind(
  activity: Pick<Activity, 'region'>,
): TravelGuideRegionKind {
  const region = activity.region?.trim();
  if (region === 'overseas' || region === 'hmt') return region;
  return 'domestic';
}

export function isTravelGuideAbroad(
  activity: Pick<Activity, 'region'>,
): boolean {
  return travelGuideRegionKind(activity) !== 'domestic';
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
    const lower =
      `${input.activity.name} ${input.activity.location ?? ''} ${dest}`.toLowerCase();
    const thailand =
      /泰国|thailand|普吉|phuket|曼谷|bangkok|芭提雅|pattaya/.test(lower);

    const base = [
      '护照原件（建议有效期 6 个月以上，留 2 页以上空白页）。',
      thailand
        ? '泰国签证：持有效护照可享免签/落地签政策（以入境当日官方为准），建议打印返程机票与酒店订单备查。'
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
  activity: Pick<Activity, 'location' | 'region'>;
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
    const lower = `${input.activity.location ?? ''} ${dest}`.toLowerCase();
    const thailand =
      /泰国|thailand|普吉|phuket|曼谷|bangkok|芭提雅|pattaya/.test(lower);

    return {
      network: [
        thailand
          ? 'AIS/TrueMove 电话卡或 eSIM，机场/711 可购；国内可提前淘宝/eSIM 平台订购。'
          : '目的地 eSIM/当地 SIM，活动场馆与郊区信号可能较弱，建议下载离线地图。',
        '国际漫游包可作备用，但现场刷票/叫车更依赖当地网络。',
        '场馆内 Wi‑Fi 不稳定，关键信息（票夹、行程）建议截图保存。',
      ],
      payment: [
        thailand
          ? '泰铢现金必备（落地签、夜市、小摊）；7‑Eleven / 商场可支付宝/微信部分商户。'
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
