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
};

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
): string {
  const city = resolveDepartureCityLabel(departureText, departureCity);
  const airport = city ? DEPARTURE_AIRPORTS[city] : undefined;
  if (airport) {
    return `${airport.name}（${airport.iata}）`;
  }
  const label = departureText.trim() || city || '出发地';
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
): string {
  const corpus =
    `${activityLocation ?? ''} ${profile.destinationCity}`.toLowerCase();

  if (profile.thailand) {
    if (/普吉|phuket|patong/.test(corpus)) {
      return '普吉国际机场（HKT）';
    }
    if (profile.bangkok) {
      return '曼谷素万那普/廊曼机场（BKK/DMK）';
    }
    return '曼谷/普吉等主要机场';
  }

  if (profile.regionKind === 'hmt') {
    if (/香港|hong\s*kong/.test(corpus)) return '香港国际机场（HKG）';
    if (/澳门|macau/.test(corpus)) return '澳门国际机场（MFM）';
    if (/台湾|台北|高雄|taoyuan/.test(corpus)) {
      return '台湾桃园/高雄等机场（TPE/KHH）';
    }
  }

  return `${profile.destinationCity}主要国际机场`;
}

/** 过滤国内高铁/火车站枢纽提示，避免污染国际段攻略。 */
export function filterDomesticTransportHints(hints: string[]): string[] {
  const domesticPattern =
    /高铁|动车|12306|北站|南站|东站|西站|福田站|广州南|虹桥|枢纽|抵深|广深|地铁11|火车站|城际轨|Railway/i;
  return hints.filter((hint) => !domesticPattern.test(hint));
}
