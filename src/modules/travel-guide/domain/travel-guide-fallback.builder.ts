import type { Activity } from '../../../database/schemas/activity.schema';
import type {
  TravelGuideBudgetTier,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import type { LlmTravelGuidePayload } from './travel-guide-llm.types';
import {
  budgetTierHotelNightRanges,
  budgetTierLabel,
  parseActivityDayCount,
} from './parse-activity-days.util';
import { normalizeGuideLines } from './travel-guide-payload-normalize.util';
import { buildTravelGuideBudgetItems } from './travel-guide-budget-estimate.util';
import {
  buildTravelGuideDocumentItems,
  buildTravelGuideEssentials,
  isTravelGuideAbroad,
  sanitizeTicketChannelsForActivity,
  travelGuideHotelBookingHint,
  travelGuideRegionKind,
} from './travel-guide-international.util';
import { destinationCityFromActivityLocation } from '../map/travel-guide-intercity.util';
import {
  buildInterCityTransportLines,
  resolveDestinationTransportProfile,
  transportSectionTitle,
  venueTransportSectionTitle,
} from './travel-guide-transport.util';
import { buildAbroadAccommodationFromHotPath } from './travel-guide-abroad-accommodation.util';
import { getTravelGuideCopy } from './travel-guide-copy';
import {
  resolveTravelGuideLocale,
  type TravelGuideLocale,
} from './travel-guide-locale';

function venueCity(location?: string): string {
  const loc = location?.trim() ?? '';
  if (!loc) return '目的地';
  const city = loc.split(/[·,，]/)[0]?.trim();
  return city || loc;
}

function buildTransportLines(
  departure: string,
  venue: string,
  activity: Activity,
  selfDrive: boolean,
  interCity: boolean,
  locale: 'zh' | 'en' = 'zh',
): string[] {
  return buildInterCityTransportLines({
    departure,
    venueTitle: venue,
    venueReadableAddress: activity.location?.trim() || venue,
    selfDrive,
    interCity,
    transportHints: [],
    destinationCity: destinationCityFromActivityLocation(activity.location),
    activity,
    locale,
  });
}

function buildParkingLines(venue: string, location: string): string[] {
  const city = venueCity(location);
  return [
    `场馆「${venue}」周边设有临时停车区，活动日车位紧张，建议 15:00 前抵达。`,
    `可提前在地图 App 收藏「${city}国际会展中心 / 电音节停车场」等关键词。`,
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
  activity: Activity,
): TravelGuidePlan['accommodation']['hotels'] {
  const city = venueCity(location);
  const room = roomHint(headcount);
  const nightLabel = `${nights} 晚`;
  const abroadBookingHint = travelGuideHotelBookingHint(activity);

  if (isTravelGuideAbroad(activity)) {
    const ranges = budgetTierHotelNightRanges(budgetTier);
    return [
      {
        name: `${city}场馆周边酒店`,
        note: `约 ${ranges.primary}/晚 · ${nightLabel} · ${room}`,
        bookingHint: abroadBookingHint,
      },
      {
        name: `${city}市中心/商圈酒店`,
        note: `约 ${ranges.secondary}/晚 · 餐饮购物方便 · ${room}`,
        bookingHint: abroadBookingHint,
      },
    ];
  }

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

/** 海外住宿占位（RollingGo 查询后会覆盖），禁止走高德酒店 POI。 */
export function buildAbroadAccommodationMapPayload(
  activity: Activity,
  budgetTier: TravelGuideBudgetTier,
  headcount: number,
  accommodationNights: number,
): Pick<LlmTravelGuidePayload, 'hotels' | 'accommodationSchemes'> {
  const curated = buildAbroadAccommodationFromHotPath(
    activity,
    budgetTier,
    headcount,
    accommodationNights,
  );
  if (curated.hotels.length) {
    return curated;
  }

  const schemes =
    buildAccommodationSchemes(
      activity.location ?? '',
      budgetTier,
      headcount,
      accommodationNights,
      activity,
    ) ?? [];
  return {
    hotels: schemes.map((scheme) => ({
      name: scheme.name,
      note: scheme.note,
      bookingHint: scheme.bookingHint,
    })),
    accommodationSchemes: schemes,
  };
}

function buildAccommodationSchemes(
  location: string,
  budgetTier: TravelGuideBudgetTier,
  headcount: number,
  nights: number,
  activity: Activity,
): TravelGuidePlan['accommodation']['schemes'] {
  const hotels = buildHotels(location, budgetTier, headcount, nights, activity);
  return [
    {
      label: '就近方案',
      name: hotels[0]?.name ?? '场馆周边酒店',
      note: hotels[0]?.note ?? '',
      reason:
        '距会场最近，散场后回程最短，适合连刷多日、不想早起赶路或想最大化在场时间的 Raver。',
      bookingHint: hotels[0]?.bookingHint,
    },
    {
      label: '市中心方案',
      name: hotels[1]?.name ?? '市中心商圈酒店',
      note: hotels[1]?.note ?? '',
      reason:
        '市中心/商圈配套更全，餐饮购物与次日出行方便，适合首次到访、想兼顾城市体验的玩家。',
      bookingHint: hotels[1]?.bookingHint,
    },
  ];
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
    '组队：提前确认出发信息与人会合方式，保持手机电量。',
  ];
  if (selfDrive) {
    items.push('自驾：检查胎压与油量，备好行驶证；勿酒后驾车。');
  }
  return items;
}

function buildExtendedSections(
  activity: Activity,
  llm: LlmTravelGuidePayload | null | undefined,
  input: {
    budgetTier: TravelGuideBudgetTier;
    headcount: number;
    accommodationNights: number;
    selfDrive: boolean;
    interCity?: boolean;
    /** When true, do not invent budget via estimate util (BudgetService owns it). */
    skipIndependentBudget?: boolean;
    locale?: TravelGuideLocale;
  },
): Pick<
  TravelGuidePlan,
  'documents' | 'tickets' | 'essentials' | 'venueTransport' | 'budget'
> {
  const destCity = destinationCityFromActivityLocation(activity.location);
  const regionKind = travelGuideRegionKind(activity);
  const interCity = Boolean(input.interCity);
  const locale = resolveTravelGuideLocale(input.locale);
  const section = getTravelGuideCopy(locale).section;

  const documentItems = llm?.documentItems?.length
    ? normalizeGuideLines(llm.documentItems)
    : isTravelGuideAbroad(activity)
      ? buildTravelGuideDocumentItems({
          activity,
          destinationCity: destCity,
          locale,
        })
      : undefined;

  const ticketChannels = sanitizeTicketChannelsForActivity(
    llm?.ticketChannels?.length ? llm.ticketChannels : undefined,
    activity,
  );

  const essentialsRaw =
    llm?.essentials ??
    buildTravelGuideEssentials({
      activity,
      destinationCity: destCity,
      interCity,
      locale,
    });

  const venueTransportOptions = llm?.venueTransportOptions?.length
    ? llm.venueTransportOptions
    : undefined;

  const budgetItems = llm?.budgetItems?.length
    ? llm.budgetItems
    : input.skipIndependentBudget
      ? []
      : buildTravelGuideBudgetItems({
          budgetTier: input.budgetTier,
          headcount: input.headcount,
          accommodationNights: input.accommodationNights,
          interCity,
          regionKind,
          selfDrive: input.selfDrive,
          locale,
        });

  return {
    ...(documentItems?.length
      ? { documents: { title: section.documents, items: documentItems } }
      : {}),
    tickets: { title: section.tickets, channels: ticketChannels },
    essentials: {
      title: section.essentials,
      network: essentialsRaw.network,
      payment: essentialsRaw.payment,
      apps: essentialsRaw.apps,
    },
    ...(venueTransportOptions?.length
      ? {
          venueTransport: {
            title: venueTransportSectionTitle(locale),
            options: venueTransportOptions,
          },
        }
      : {}),
    ...(budgetItems.length
      ? { budget: { title: section.budget, items: budgetItems } }
      : {}),
  };
}

export function buildTravelGuidePlan(input: {
  activity: Activity;
  departure: string;
  headcount: number;
  budgetTier: TravelGuideBudgetTier;
  accommodationNights?: number;
  selfDrive?: boolean;
  note?: string;
  llm?: LlmTravelGuidePayload | null;
  /** 为 true 时禁止回退到静态模板（仅接受地图/地图+AI 链路产出） */
  mapSourcedOnly?: boolean;
  interCity?: boolean;
  /**
   * When true, skip estimate-based budget inside this builder.
   * Authoritative budget must come from BudgetService via llm.budgetItems / assembler.
   */
  skipIndependentBudget?: boolean;
  locale?: TravelGuideLocale;
}): TravelGuidePlan {
  const { activity, departure, headcount, budgetTier } = input;
  const selfDrive = Boolean(input.selfDrive);
  const mapSourcedOnly = Boolean(input.mapSourcedOnly);
  const locale = resolveTravelGuideLocale(input.locale);
  const copy = getTravelGuideCopy(locale);
  const venue = activity.location?.trim() || copy.fallback.venue;
  const eventDates = activity.date?.trim() || copy.fallback.eventDates;
  const accommodationNights =
    input.accommodationNights ?? parseActivityDayCount(activity.date);
  const budgetLabel = budgetTierLabel(budgetTier, locale);

  if (mapSourcedOnly && !input.llm) {
    throw new Error(
      'mapSourcedOnly requires llm payload from Amap Map pipeline',
    );
  }

  const interCity = Boolean(input.interCity);
  const destCity = destinationCityFromActivityLocation(activity.location);
  const transportProfile = resolveDestinationTransportProfile({
    destinationCity: destCity,
    activity,
  });

  const transportLines = input.llm?.transportLines?.length
    ? normalizeGuideLines(input.llm.transportLines)
    : mapSourcedOnly
      ? []
      : buildTransportLines(
          departure,
          venue,
          activity,
          selfDrive,
          interCity,
          locale,
        );

  const schemes = input.llm?.accommodationSchemes?.length
    ? input.llm.accommodationSchemes
    : mapSourcedOnly || accommodationNights <= 0
      ? undefined
      : buildAccommodationSchemes(
          activity.location ?? '',
          budgetTier,
          headcount,
          accommodationNights,
          activity,
        );

  const hotels = input.llm?.hotels?.length
    ? input.llm.hotels
    : schemes
      ? schemes.map((s) => ({
          name: s.name,
          note: s.note,
          bookingHint: s.bookingHint,
        }))
      : mapSourcedOnly || accommodationNights <= 0
        ? []
        : buildHotels(
            activity.location ?? '',
            budgetTier,
            headcount,
            accommodationNights,
            activity,
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

  const note = input.note?.trim();
  const tipItemsBase = input.llm?.tipItems?.length
    ? normalizeGuideLines(input.llm.tipItems)
    : mapSourcedOnly
      ? []
      : buildTips(selfDrive);
  const tipItems = note
    ? [...tipItemsBase, copy.fallback.companionNote(note)]
    : tipItemsBase;

  const extended = buildExtendedSections(activity, input.llm, {
    budgetTier,
    headcount,
    accommodationNights,
    selfDrive,
    interCity: input.interCity,
    skipIndependentBudget: input.skipIndependentBudget,
    locale,
  });

  return {
    activityName: activity.name,
    venue,
    eventDates,
    departure,
    headcount,
    budgetLabel,
    accommodationNights,
    selfDrive,
    transport: {
      title: transportSectionTitle(interCity, transportProfile, locale),
      lines: transportLines,
    },
    accommodation: {
      title: copy.section.accommodation,
      hotels,
      ...(schemes?.length ? { schemes } : {}),
    },
    ...(parkingLines?.length
      ? { parking: { title: copy.section.parking, lines: parkingLines } }
      : {}),
    nightlife: { title: copy.section.nightlife, spots: nightlifeSpots },
    tips: { title: copy.section.tips, items: tipItems },
    ...extended,
  };
}
