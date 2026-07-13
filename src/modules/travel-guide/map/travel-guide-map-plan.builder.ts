import type { Activity } from '../../../database/schemas/activity.schema';
import type {
  TravelGuideAccommodationScheme,
  TravelGuideBudgetTier,
  TravelGuideHotelItem,
  TravelGuideSpotItem,
  TravelGuideTicketChannel,
} from '@sync/travel-guide-contracts';
import type { LlmTravelGuidePayload } from '../domain/travel-guide-llm.types';
import {
  TRAVEL_GUIDE_TIER_HOTEL_LIST_LIMIT,
  TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT,
  tierAccommodationSchemeLabel,
  tierAccommodationSchemeReason,
} from '../domain/travel-guide-accommodation.constants';
import { buildTravelGuideBudgetItems } from '../domain/travel-guide-budget-estimate.util';
import {
  formatTravelGuideMoney,
  formatTravelGuideMoneyRange,
} from '../domain/travel-guide-currency.util';
import { buildAbroadAccommodationMapPayload } from '../domain/travel-guide-fallback.builder';
import {
  buildTravelGuideDocumentItems,
  buildTravelGuideEssentials,
  buildTravelGuideTicketChannels,
  travelGuideHotelBookingHint,
  travelGuideRegionKind,
} from '../domain/travel-guide-international.util';
import {
  buildInterCityTransportLines,
  buildVenueTransportOptions,
} from '../domain/travel-guide-transport.util';
import { destinationCityFromActivityLocation } from './travel-guide-intercity.util';
import type {
  DrivingRouteSummary,
  RankedMapPoi,
  TravelGuideMapContext,
  TravelGuideRankedCandidates,
} from './travel-guide-map.types';

export { TRAVEL_GUIDE_TIER_HOTEL_LIST_LIMIT as TRAVEL_GUIDE_HOTEL_LIST_LIMIT };
export const TRAVEL_GUIDE_NIGHTLIFE_LIST_LIMIT = 6;

// Some curated POIs only have a local-language name in the static seed data.
// Keep English plans fully English without changing the source names used by
// Chinese plans or map lookups.
const ENGLISH_POI_NAMES: Record<string, string> = {
  '海底捞火锅(沙井京基百纳店)': 'Haidilao Hot Pot (Shajing Kingkey Branch)',
  '潮汕砂锅粥(沙井店)': 'Chaoshan Claypot Congee (Shajing Branch)',
  永宗岛韩式烤肉: 'Yeongjong-do Korean BBQ',
  仁川机场美食街: 'Incheon Airport Food Street',
  江南深夜烤肉: 'Gangnam Late-night BBQ',
  蚕室夜市小吃街: 'Jamsil Night Market Food Street',
  台场深夜章鱼烧: 'Odaiba Late-night Takoyaki',
  新桥居酒屋通: 'Shimbashi Izakaya Street',
  台场拉面横丁: 'Odaiba Ramen Alley',
  涩谷深夜烧鸟: 'Shibuya Late-night Yakitori',
  '海底捞火锅(西藏南路店)': 'Haidilao Hot Pot (Xizang South Road Branch)',
  '很久以前羊肉串(世博源店)':
    'Hengjiu Yiqian Lamb Skewers (Expo Source Branch)',
};

function poiNameForLocale(name: string, locale: 'zh' | 'en'): string {
  return locale === 'en' ? (ENGLISH_POI_NAMES[name] ?? name) : name;
}

function resolveMapTransportRoute(
  ctx: TravelGuideMapContext,
  selfDrive: boolean,
  interCity: boolean,
): DrivingRouteSummary | undefined {
  if (selfDrive) return ctx.drivingRoute;
  if (!interCity) return ctx.transitRoute ?? ctx.drivingRoute;
  return ctx.drivingRoute ?? ctx.transitRoute;
}

export function buildTransportLinesFromMap(
  departure: string,
  venueTitle: string,
  venueReadableAddress: string,
  selfDrive: boolean,
  route?: DrivingRouteSummary,
  hints: string[] = [],
  interCity = false,
  activity?: Activity,
  departureCity?: string,
  transitDetailLines?: string[],
  locale: 'zh' | 'en' = 'zh',
): string[] {
  return buildInterCityTransportLines({
    departure,
    venueTitle,
    venueReadableAddress,
    selfDrive,
    interCity,
    route,
    transitDetailLines,
    transportHints: hints,
    destinationCity: activity
      ? destinationCityFromActivityLocation(activity.location)
      : undefined,
    departureCity,
    activity,
    locale,
  });
}

export { buildVenueTransportOptions } from '../domain/travel-guide-transport.util';

export function buildTicketChannels(
  activity: Pick<
    Activity,
    'name' | 'externalUrl' | 'region' | 'code' | 'location'
  >,
  locale: 'zh' | 'en' = 'zh',
): TravelGuideTicketChannel[] {
  return buildTravelGuideTicketChannels(activity, locale);
}

export function buildParkingLinesFromMap(
  ranked: RankedMapPoi[],
  venueTitle: string,
  locale: 'zh' | 'en' = 'zh',
): string[] {
  const top = ranked.slice(0, 2);
  if (!top.length) {
    return locale === 'en'
      ? [
          `Navigate to 「${venueTitle}」 and search parking in your maps app; arrive 1–2 hours early on show days.`,
        ]
      : [
          `导航「${venueTitle}」并在高德地图搜索「停车场」，活动日建议提前 1–2 小时抵达。`,
        ];
  }

  return top.map((p) =>
    locale === 'en'
      ? `「${p.name}」 ~${formatKm(p.distanceM)} from venue · ${p.address || 'see maps app'}`
      : `「${p.name}」距会场约 ${formatKm(p.distanceM)} · ${p.address || '详见高德地图'}`,
  );
}

export function hotelsFromRanked(
  ranked: RankedMapPoi[],
  nightLabel: string,
  roomHint: string,
  priceBands: [string, string],
  activity?: Pick<Activity, 'region'>,
  schemeHotels?: RankedMapPoi[],
  budgetTier: TravelGuideBudgetTier = 'standard',
  locale: 'zh' | 'en' = 'zh',
): TravelGuideHotelItem[] {
  const bookingHint = activity
    ? travelGuideHotelBookingHint(activity, locale)
    : locale === 'en'
      ? 'Trip.com / Meituan'
      : '携程 / 美团';
  const picked = ranked.slice(0, TRAVEL_GUIDE_TIER_HOTEL_LIST_LIMIT);
  if (!picked.length) return [];

  return picked.map((p, index) => {
    const band = index === 0 ? priceBands[0] : priceBands[1];
    const ratingText =
      p.rating != null
        ? locale === 'en'
          ? ` · rating ${p.rating}`
          : ` · 评分 ${p.rating}`
        : '';
    const distanceText =
      p.distanceLabel?.trim() ||
      (locale === 'en'
        ? `~${formatKm(p.distanceM)} to venue`
        : `距会场约 ${formatKm(p.distanceM)}`);
    const priceLabel = hotelNightPriceLabel(p.avgPrice, band, locale);
    return {
      name: p.name,
      note: `${priceLabel} · ${distanceText}${ratingText} · ${nightLabel} · ${roomHint}`,
      reason: hotelReasonFromPoi(p, schemeHotels, budgetTier, locale),
      bookingHint,
    };
  });
}

export function accommodationSchemesFromRanked(
  schemeHotels: RankedMapPoi[],
  nightLabel: string,
  roomHint: string,
  priceBands: [string, string],
  activity?: Pick<Activity, 'region'>,
  budgetTier: TravelGuideBudgetTier = 'standard',
  locale: 'zh' | 'en' = 'zh',
): TravelGuideAccommodationScheme[] {
  const bookingHint = activity
    ? travelGuideHotelBookingHint(activity, locale)
    : locale === 'en'
      ? 'Trip.com / Meituan / Fliggy'
      : '携程 / 美团 / 飞猪';

  return schemeHotels
    .slice(0, TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT)
    .map((poi, index) =>
      schemeFromPoi(
        poi,
        tierAccommodationSchemeLabel(index, budgetTier, locale),
        tierAccommodationSchemeReason(poi, budgetTier, index, locale),
        nightLabel,
        roomHint,
        index === 0 ? priceBands[0] : priceBands[1],
        bookingHint,
        locale,
      ),
    );
}

function schemeFromPoi(
  p: RankedMapPoi,
  label: string,
  reason: string,
  nightLabel: string,
  roomHint: string,
  priceBand: string,
  bookingHint: string,
  locale: 'zh' | 'en' = 'zh',
): TravelGuideAccommodationScheme {
  const ratingText =
    p.rating != null
      ? locale === 'en'
        ? ` · rating ${p.rating}`
        : ` · 评分 ${p.rating}`
      : '';
  const distanceText =
    p.distanceLabel?.trim() ||
    (locale === 'en'
      ? `~${formatKm(p.distanceM)} to venue`
      : `距会场约 ${formatKm(p.distanceM)}`);
  const priceLabel = hotelNightPriceLabel(p.avgPrice, priceBand, locale);
  return {
    label,
    name: p.name,
    note: `${priceLabel} · ${distanceText}${ratingText} · ${nightLabel} · ${roomHint}`,
    reason,
    bookingHint,
  };
}

function hotelNightPriceLabel(
  avgPrice: number | string | null | undefined,
  band: string,
  locale: 'zh' | 'en',
): string {
  const suffix = locale === 'en' ? '/night' : '/晚';
  const priceValue = Number(avgPrice);
  if (Number.isFinite(priceValue) && priceValue > 0) {
    return formatTravelGuideMoney(priceValue, 'CNY', locale, { suffix });
  }
  const nums = String(band).match(/\d+/g)?.map(Number) ?? [];
  if (nums.length >= 2) {
    return formatTravelGuideMoneyRange(nums[0]!, nums[1]!, 'CNY', locale, {
      suffix,
    });
  }
  if (nums.length === 1) {
    return formatTravelGuideMoney(nums[0]!, 'CNY', locale, { suffix });
  }
  return locale === 'en' ? `From ${band}/night` : `起步约 ¥${band}/晚`;
}

export function nightlifeFromRanked(
  ranked: RankedMapPoi[],
  eventEndHour: number,
  locale: 'zh' | 'en' = 'zh',
): TravelGuideSpotItem[] {
  return ranked.slice(0, TRAVEL_GUIDE_NIGHTLIFE_LIST_LIMIT).map((p) => ({
    name: poiNameForLocale(p.name, locale),
    note: formatNightlifeNote(p, locale),
    reason: nightlifeReasonFromPoi(p, eventEndHour, locale),
  }));
}

/** 酒店名单与排序以地图排序为准；LLM 仅润色同名酒店的 note */
export function mergeRankedHotelsWithLlmPolish(
  ranked: TravelGuideHotelItem[],
  llmHotels: TravelGuideHotelItem[] | undefined,
): TravelGuideHotelItem[] {
  if (!llmHotels?.length) return ranked;
  const llmByName = new Map(llmHotels.map((h) => [h.name, h]));
  return ranked.map((hotel) => {
    const polished = llmByName.get(hotel.name);
    if (!polished) return hotel;
    return {
      name: hotel.name,
      note: polished.note?.trim() ? polished.note : hotel.note,
      reason: polished.reason?.trim() ? polished.reason : hotel.reason,
      bookingHint: polished.bookingHint?.trim() || hotel.bookingHint,
    };
  });
}

/** 散场夜宵以地图排序为准；LLM 仅润色同名店铺的 note/reason */
export function mergeNightlifeWithLlmPolish(
  ranked: TravelGuideSpotItem[],
  llmSpots: TravelGuideSpotItem[] | undefined,
): TravelGuideSpotItem[] {
  if (!llmSpots?.length) return ranked;
  const llmByName = new Map(llmSpots.map((s) => [s.name, s]));
  return ranked.map((spot) => {
    const polished = llmByName.get(spot.name);
    if (!polished) return spot;
    return {
      name: spot.name,
      note: polished.note?.trim() ? polished.note : spot.note,
      reason: polished.reason?.trim() ? polished.reason : spot.reason,
    };
  });
}

export function mergeAccommodationSchemesWithLlmPolish(
  ranked: TravelGuideAccommodationScheme[],
  llmSchemes: TravelGuideAccommodationScheme[] | undefined,
): TravelGuideAccommodationScheme[] {
  if (!llmSchemes?.length) return ranked;
  const llmByLabel = new Map(llmSchemes.map((s) => [s.label, s]));
  const llmByName = new Map(llmSchemes.map((s) => [s.name, s]));
  return ranked.map((scheme) => {
    const polished = llmByLabel.get(scheme.label) ?? llmByName.get(scheme.name);
    if (!polished) return scheme;
    return {
      label: scheme.label,
      name: scheme.name,
      note: polished.note?.trim() ? polished.note : scheme.note,
      reason: polished.reason?.trim() ? polished.reason : scheme.reason,
      bookingHint: polished.bookingHint?.trim() || scheme.bookingHint,
    };
  });
}

export function mapCandidatesToLlmFallback(
  ctx: TravelGuideMapContext,
  ranked: TravelGuideRankedCandidates,
  input: {
    departure: string;
    departureCity?: string;
    selfDrive: boolean;
    accommodationNights: number;
    headcount: number;
    activity: Activity;
    locale?: 'zh' | 'en';
  },
): LlmTravelGuidePayload {
  const locale = input.locale === 'en' ? 'en' : 'zh';
  const en = locale === 'en';
  const room = en
    ? input.headcount <= 1
      ? 'Single occupancy'
      : input.headcount === 2
        ? 'Twin / king room is fine'
        : `About ${Math.ceil(input.headcount / 2)} rooms`
    : input.headcount <= 1
      ? '单人入住'
      : input.headcount === 2
        ? '双床/大床房即可'
        : `建议 ${Math.ceil(input.headcount / 2)} 间房`;
  const nightLabel = en
    ? `${input.accommodationNights} night(s)`
    : `${input.accommodationNights} 晚`;
  const destCity = destinationCityFromActivityLocation(input.activity.location);
  const regionKind = travelGuideRegionKind(input.activity);
  const interCity = Boolean(ctx.interCity);
  const needsAccommodation = input.accommodationNights > 0;
  const useRollingGoAccommodation =
    needsAccommodation &&
    regionKind !== 'domestic' &&
    ranked.hotels.length === 0;

  let hotels: LlmTravelGuidePayload['hotels'] = [];
  let schemes: LlmTravelGuidePayload['accommodationSchemes'] = [];

  if (useRollingGoAccommodation) {
    const abroadPayload = buildAbroadAccommodationMapPayload(
      input.activity,
      ranked.budgetTier,
      input.headcount,
      input.accommodationNights,
    );
    hotels = abroadPayload.hotels;
    schemes = abroadPayload.accommodationSchemes ?? [];
  } else if (needsAccommodation) {
    const schemeHotels =
      ranked.accommodationPicks?.schemeHotels ??
      (ranked.hotels.length
        ? ranked.hotels.slice(0, TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT)
        : []);
    schemes = schemeHotels.length
      ? accommodationSchemesFromRanked(
          schemeHotels,
          nightLabel,
          room,
          ranked.hotelPriceBand,
          input.activity,
          ranked.budgetTier,
          locale,
        )
      : [];
    hotels = hotelsFromRanked(
      ranked.hotels,
      nightLabel,
      room,
      ranked.hotelPriceBand,
      input.activity,
      schemeHotels,
      ranked.budgetTier,
      locale,
    );
  }

  const documentItems =
    regionKind !== 'domestic'
      ? buildTravelGuideDocumentItems({
          activity: input.activity,
          destinationCity: destCity,
          locale,
        })
      : undefined;

  const essentials = buildTravelGuideEssentials({
    activity: input.activity,
    destinationCity: destCity,
    interCity,
    locale,
  });

  const transitDetailLines = ctx.transitDetail?.detailLines;
  const transportRoute = resolveMapTransportRoute(
    ctx,
    input.selfDrive,
    interCity,
  );

  const tipItems = needsAccommodation
    ? regionKind !== 'domestic'
      ? en
        ? [
            'Afterparty and late-bite picks are curated; stays prefer live RollingGo quotes, with nearby references when quotes are missing — confirm OTA rates before booking.',
            'Prefer spots still open after the show; leave with friends late at night.',
          ]
        : [
            '散场与夜宵点位来自精选推荐；住宿优先 RollingGo 实时查询，无报价时展示场馆周边精选参考，下单前请在 OTA 核实价格与房态。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
          ]
      : en
        ? [
            'Transport, stays, and afterparty picks come from map search ranked by budget and distance.',
            'Prefer spots still open after the show; leave with friends late at night.',
            'Hotel and restaurant ratings follow the map platform — re-check OTA rates before booking.',
          ]
        : [
            '以上交通、住宿与散场点位来自高德地图周边检索，并结合预算与距离智能排序。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
            '酒店与餐厅评分以地图平台展示为准，下单前建议在 OTA 再确认价格与房态。',
          ]
    : regionKind !== 'domestic'
      ? en
        ? [
            'Afterparty and late-bite picks are curated and ranked by distance.',
            'Prefer spots still open after the show; leave with friends late at night.',
          ]
        : [
            '散场与夜宵点位来自精选推荐，并结合距离智能排序。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
          ]
      : en
        ? [
            'Transport and afterparty picks come from map search ranked by distance.',
            'Prefer spots still open after the show; leave with friends late at night.',
          ]
        : [
            '以上交通与散场点位来自高德地图周边检索，并结合距离智能排序。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
          ];

  return {
    transportLines: buildTransportLinesFromMap(
      input.departure,
      ctx.venue.title,
      ctx.venueReadableAddress,
      input.selfDrive,
      transportRoute,
      ctx.transportHints,
      interCity,
      input.activity,
      input.departureCity,
      transitDetailLines,
      locale,
    ),
    hotels,
    accommodationSchemes: schemes,
    // Overseas vehicle-access anchors are not verified car-park coordinates,
    // so do not present them as parking recommendations yet.
    parkingLines:
      input.selfDrive && regionKind === 'domestic'
        ? buildParkingLinesFromMap(ranked.parking, ctx.venue.title, locale)
        : undefined,
    nightlifeSpots: nightlifeFromRanked(
      ranked.nightlife,
      ctx.eventEndHour,
      locale,
    ),
    tipItems,
    documentItems,
    ticketChannels: buildTicketChannels(input.activity, locale),
    essentials,
    venueTransportOptions: buildVenueTransportOptions({
      departure: input.departure,
      venueTitle: ctx.venue.title,
      venueReadableAddress: ctx.venueReadableAddress,
      selfDrive: input.selfDrive,
      interCity,
      route: transportRoute,
      transitDetailLines,
      transportHints: ctx.transportHints,
      destinationCity: destCity,
      departureCity: input.departureCity,
      activity: input.activity,
      locale,
    }),
    budgetItems: buildTravelGuideBudgetItems({
      budgetTier: ranked.budgetTier,
      headcount: input.headcount,
      accommodationNights: input.accommodationNights,
      interCity,
      regionKind,
      selfDrive: input.selfDrive,
      locale,
    }),
  };
}

function formatNightlifeNote(
  p: RankedMapPoi,
  locale: 'zh' | 'en' = 'zh',
): string {
  if (locale === 'en') {
    const parts = [`~${formatKm(p.distanceM)} to venue`];
    if (p.rating != null) parts.push(`rating ~${p.rating}`);
    if (p.lateNightFriendly) parts.push('good after the show');
    if (p.address) parts.push(p.address);
    return parts.join(' · ');
  }
  const parts = [`距会场约 ${formatKm(p.distanceM)}`];
  if (p.rating != null) parts.push(`评分约 ${p.rating}`);
  if (p.lateNightFriendly) parts.push('适合散场后前往');
  if (p.address) parts.push(p.address);
  return parts.join(' · ');
}

function hotelReasonFromPoi(
  p: RankedMapPoi,
  schemeHotels?: RankedMapPoi[],
  budgetTier: TravelGuideBudgetTier = 'standard',
  locale: 'zh' | 'en' = 'zh',
): string {
  if (schemeHotels?.length) {
    const index = schemeHotels.findIndex((h) => h.name === p.name);
    if (index >= 0) {
      return tierAccommodationSchemeReason(p, budgetTier, index, locale);
    }
  }

  if (locale === 'en') {
    const parts: string[] = [];
    if (p.distanceM <= 800) {
      parts.push(
        'Walk or short hop to the venue — fastest return after the show',
      );
    } else if (p.distanceM <= 1500) {
      parts.push(
        'Mid-distance to the venue — a few minutes by taxi, balanced convenience',
      );
    } else if (p.distanceM >= 2000) {
      parts.push('In a commercial / city area — better dining and shopping');
    } else {
      parts.push('Balanced distance, rating, and budget — solid backup');
    }
    if (p.rating != null && p.rating >= 4.5) {
      parts.push('Strong map rating');
    }
    if (/五星|豪华|度假|luxury|resort|5.?star/i.test(p.category)) {
      parts.push('Higher-end stay for comfort seekers');
    } else if (/快捷|经济|连锁|budget|express|inn/i.test(p.category)) {
      parts.push('Budget / chain stay for cost control');
    }
    return `${parts.join('; ')}.`;
  }

  const parts: string[] = [];
  if (p.distanceM <= 800) {
    parts.push('步行或短途即可到会场，散场后回酒店最省时');
  } else if (p.distanceM <= 1500) {
    parts.push('距会场适中，打车几分钟可达，便利与性价比兼顾');
  } else if (p.distanceM >= 2000) {
    parts.push('位于商圈或市区，餐饮购物方便，适合兼顾城市体验');
  } else {
    parts.push('综合距离、评分与预算入选，可作为备选');
  }
  if (p.rating != null && p.rating >= 4.5) {
    parts.push('地图评分较高，口碑相对稳定');
  }
  if (/五星|豪华|度假/.test(p.category)) {
    parts.push('档次偏高，适合追求住宿体验');
  } else if (/快捷|经济|连锁/.test(p.category)) {
    parts.push('连锁/经济型，适合控预算');
  }
  return `${parts.join('；')}。`;
}

function nightlifeReasonFromPoi(
  p: RankedMapPoi,
  eventEndHour: number,
  locale: 'zh' | 'en' = 'zh',
): string {
  if (locale === 'en') {
    const parts: string[] = [];
    if (p.lateNightFriendly) {
      parts.push('Open late enough for post-show fuel');
    }
    if (/24/.test(`${p.name} ${p.category}`)) {
      parts.push('24h — fine if the show runs late');
    }
    if (
      /火锅|烧烤|串|砂锅|粥|夜宵|宵夜|bbq|hot.?pot|noodle/i.test(
        `${p.name} ${p.category}`,
      )
    ) {
      parts.push('Good for groups and a quick fill');
    }
    if (p.distanceM <= 1500) {
      parts.push('Close to the venue — walk or short ride');
    } else if (p.distanceM <= 3500) {
      parts.push('Acceptable distance if you want the spot');
    }
    if (eventEndHour >= 22) {
      parts.push('Matches late-night festival timing');
    }
    if (!parts.length) {
      parts.push('Ranked by distance and rating as a backup');
    }
    return `${parts.slice(0, 3).join('; ')}.`;
  }

  const parts: string[] = [];
  if (p.lateNightFriendly) {
    parts.push('营业时段覆盖散场后，适合凌晨补能量');
  }
  if (/24/.test(`${p.name} ${p.category}`)) {
    parts.push('24 小时营业，不怕散场太晚');
  }
  if (/火锅|烧烤|串|砂锅|粥|夜宵|宵夜/.test(`${p.name} ${p.category}`)) {
    parts.push('品类适合多人聚食、快速填饱');
  }
  if (p.distanceM <= 1500) {
    parts.push('离会场近，散场后打车或步行都方便');
  } else if (p.distanceM <= 3500) {
    parts.push('距离可接受，值得一去');
  }
  if (eventEndHour >= 22) {
    parts.push('与深夜场次节奏匹配');
  }
  if (!parts.length) {
    parts.push('综合距离与评分入选，散场后可作备选');
  }
  return `${parts.slice(0, 3).join('；')}。`;
}

function formatKm(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(1)}km`;
}
