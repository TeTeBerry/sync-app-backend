import type { Activity } from '../../../database/schemas/activity.schema';
import type {
  LlmTravelGuidePayload,
  TravelGuideBudgetTier,
  TravelGuidePlan,
} from './travel-guide.types';
import {
  budgetTierHotelNightRanges,
  budgetTierLabel,
  parseActivityDayCount,
} from './parse-activity-days.util';
import { normalizeGuideLines } from './travel-guide-payload-normalize.util';

function venueCity(location?: string): string {
  const loc = location?.trim() ?? '';
  if (!loc) return '目的地';
  const city = loc.split(/[·,，]/)[0]?.trim();
  return city || loc;
}

function buildTransportLines(
  departure: string,
  venue: string,
  location: string,
  selfDrive: boolean,
): string[] {
  const city = venueCity(location);
  const lines = [`建议提前 1 天从「${departure}」出发，预留转场与入住缓冲。`];

  if (selfDrive) {
    lines.push(
      `自驾前往${city}：导航「${venue}」，高速+市区合计预留 4–6 小时（视出发地而定）。`,
      '散场后场馆周边拥堵，建议提前确认停车场与离场路线。',
    );
  } else {
    lines.push(
      `高铁/飞机抵达${city}后，可打车或地铁前往「${venue}」，高峰建议预留 40–60 分钟。`,
      `散场时段优先预约网约车；${city}返程票建议提前购买。`,
    );
  }

  return lines;
}

function buildParkingLines(venue: string, location: string): string[] {
  const city = venueCity(location);
  return [
    `场馆「${venue}」周边设有临时停车区，活动日车位紧张，建议 15:00 前抵达。`,
    `可提前在地图 App 收藏「${city}国际会展中心 / 音乐节停车场」等关键词。`,
    '散场后出车高峰约 30–60 分钟，可先在车内休息或约夜宵点汇合再离场。',
  ];
}

function roomHint(headcount: number): string {
  if (headcount <= 1) return '单人入住';
  if (headcount === 2) return '双床/大床房即可';
  const rooms = Math.ceil(headcount / 2);
  return `建议 ${rooms} 间房（${headcount} 人可双人间拼住）`;
}

function buildHotels(
  location: string,
  budgetTier: TravelGuideBudgetTier,
  headcount: number,
  nights: number,
): TravelGuidePlan['accommodation']['hotels'] {
  const city = venueCity(location);
  const room = roomHint(headcount);
  const nightLabel = `${nights} 晚`;

  const ranges = budgetTierHotelNightRanges(budgetTier);

  const tiers: Record<
    TravelGuideBudgetTier,
    TravelGuidePlan['accommodation']['hotels']
  > = {
    economy: [
      {
        name: `${city}地铁沿线连锁酒店`,
        note: `约 ${ranges.primary}/晚 · ${nightLabel} · ${room}`,
        bookingHint: '美团 / 携程「近地铁」',
      },
      {
        name: `${city}会展中心周边快捷酒店`,
        note: `约 ${ranges.secondary}/晚 · 步行/接驳场馆 · ${room}`,
        bookingHint: '飞猪「国际会展中心」',
      },
    ],
    standard: [
      {
        name: `${city}会展中心商务酒店`,
        note: `约 ${ranges.primary}/晚 · ${nightLabel} · ${room}`,
        bookingHint: '携程 / Booking',
      },
      {
        name: `${city}核心商圈四星酒店`,
        note: `约 ${ranges.secondary}/晚 · 散场后餐饮方便 · ${room}`,
        bookingHint: '大众点评高分榜',
      },
    ],
    comfort: [
      {
        name: `${city}五星/精品设计酒店`,
        note: `约 ${ranges.primary}/晚 · ${nightLabel} · ${room}`,
        bookingHint: 'Booking / 酒店官网',
      },
      {
        name: `${city}度假型豪华酒店`,
        note: `约 ${ranges.secondary}/晚 · 适合多人同行品质出行 · ${room}`,
        bookingHint: '携程「豪华型」',
      },
    ],
  };

  return tiers[budgetTier];
}

function buildNightlife(
  location: string,
): TravelGuidePlan['nightlife']['spots'] {
  const city = venueCity(location);
  return [
    {
      name: `${city}场馆周边夜宵`,
      note: '火锅、烧烤、砂锅粥等；散场后 1–2 小时内仍营业的优先，结伴出行注意安全。',
    },
    {
      name: '深夜食堂 / 大排档',
      note: '适合散场后补充能量，提前在地图确认营业时间。',
    },
  ];
}

function buildTips(selfDrive: boolean): string[] {
  const items = [
    '安检：禁带长柄伞、打火机、专业拍摄杆；液体按容量限制携带。',
    '必带：身份证、充电宝、耳塞、防水袋、少量现金。',
    '穿搭：舒适鞋 + 透气衣物；场内可备薄外套。',
    '组队：提前约好集合点与散场汇合方式，保持手机电量。',
  ];
  if (selfDrive) {
    items.push('自驾：检查胎压与油量，备好行驶证；勿酒后驾车。');
  }
  return items;
}

export function buildTravelGuidePlan(input: {
  activity: Activity;
  departure: string;
  headcount: number;
  budgetTier: TravelGuideBudgetTier;
  accommodationNights?: number;
  selfDrive?: boolean;
  llm?: LlmTravelGuidePayload | null;
  /** 为 true 时禁止回退到静态模板（仅接受地图/地图+AI 链路产出） */
  mapSourcedOnly?: boolean;
}): TravelGuidePlan {
  const { activity, departure, headcount, budgetTier } = input;
  const selfDrive = Boolean(input.selfDrive);
  const mapSourcedOnly = Boolean(input.mapSourcedOnly);
  const venue = activity.location?.trim() || '活动场馆';
  const eventDates = activity.date?.trim() || '详见官方日程';
  const accommodationNights =
    input.accommodationNights ?? parseActivityDayCount(activity.date);
  const budgetLabel = budgetTierLabel(budgetTier);

  if (mapSourcedOnly && !input.llm) {
    throw new Error(
      'mapSourcedOnly requires llm payload from Amap Map pipeline',
    );
  }

  const transportLines = input.llm?.transportLines?.length
    ? normalizeGuideLines(input.llm.transportLines)
    : mapSourcedOnly
      ? []
      : buildTransportLines(
          departure,
          venue,
          activity.location ?? '',
          selfDrive,
        );

  const hotels = input.llm?.hotels?.length
    ? input.llm.hotels
    : mapSourcedOnly
      ? []
      : buildHotels(
          activity.location ?? '',
          budgetTier,
          headcount,
          accommodationNights,
        );

  const parkingLines =
    selfDrive && input.llm?.parkingLines?.length
      ? normalizeGuideLines(input.llm.parkingLines)
      : selfDrive && !mapSourcedOnly
        ? buildParkingLines(venue, activity.location ?? '')
        : undefined;

  const nightlifeSpots = input.llm?.nightlifeSpots?.length
    ? input.llm.nightlifeSpots
    : mapSourcedOnly
      ? []
      : buildNightlife(activity.location ?? '');

  const tipItems = input.llm?.tipItems?.length
    ? normalizeGuideLines(input.llm.tipItems)
    : mapSourcedOnly
      ? []
      : buildTips(selfDrive);

  return {
    activityName: activity.name,
    venue,
    eventDates,
    departure,
    headcount,
    budgetLabel,
    accommodationNights,
    selfDrive,
    transport: { title: '交通方案', lines: transportLines },
    accommodation: { title: '住宿推荐', hotels },
    ...(parkingLines?.length
      ? { parking: { title: '停车指引', lines: parkingLines } }
      : {}),
    nightlife: { title: '散场 夜宵', spots: nightlifeSpots },
    tips: { title: '小贴士', items: tipItems },
  };
}
