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
  });
}

export { buildVenueTransportOptions } from '../domain/travel-guide-transport.util';

export function buildTicketChannels(
  activity: Pick<
    Activity,
    'name' | 'externalUrl' | 'region' | 'code' | 'location'
  >,
): TravelGuideTicketChannel[] {
  return buildTravelGuideTicketChannels(activity);
}

export function buildParkingLinesFromMap(
  ranked: RankedMapPoi[],
  venueTitle: string,
): string[] {
  const top = ranked.slice(0, 2);
  if (!top.length) {
    return [
      `导航「${venueTitle}」并在高德地图搜索「停车场」，活动日建议提前 1–2 小时抵达。`,
    ];
  }

  return top.map(
    (p) =>
      `「${p.name}」距会场约 ${formatKm(p.distanceM)} · ${p.address || '详见高德地图'}`,
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
): TravelGuideHotelItem[] {
  const bookingHint = activity
    ? travelGuideHotelBookingHint(activity)
    : '携程 / 美团';
  const picked = ranked.slice(0, TRAVEL_GUIDE_TIER_HOTEL_LIST_LIMIT);
  if (!picked.length) return [];

  return picked.map((p, index) => {
    const band = index === 0 ? priceBands[0] : priceBands[1];
    const ratingText = p.rating != null ? ` · 评分 ${p.rating}` : '';
    const distanceText =
      p.distanceLabel?.trim() || `距会场约 ${formatKm(p.distanceM)}`;
    return {
      name: p.name,
      note: `起步约 ¥${p.avgPrice ?? band}/晚 · ${distanceText}${ratingText} · ${nightLabel} · ${roomHint}`,
      reason: hotelReasonFromPoi(p, schemeHotels, budgetTier),
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
): TravelGuideAccommodationScheme[] {
  const bookingHint = activity
    ? travelGuideHotelBookingHint(activity)
    : '携程 / 美团 / 飞猪';

  return schemeHotels
    .slice(0, TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT)
    .map((poi, index) =>
      schemeFromPoi(
        poi,
        tierAccommodationSchemeLabel(index, budgetTier),
        tierAccommodationSchemeReason(poi, budgetTier, index),
        nightLabel,
        roomHint,
        index === 0 ? priceBands[0] : priceBands[1],
        bookingHint,
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
): TravelGuideAccommodationScheme {
  const ratingText = p.rating != null ? ` · 评分 ${p.rating}` : '';
  const distanceText =
    p.distanceLabel?.trim() || `距会场约 ${formatKm(p.distanceM)}`;
  return {
    label,
    name: p.name,
    note: `起步约 ¥${p.avgPrice ?? priceBand}/晚 · ${distanceText}${ratingText} · ${nightLabel} · ${roomHint}`,
    reason,
    bookingHint,
  };
}

export function nightlifeFromRanked(
  ranked: RankedMapPoi[],
  eventEndHour: number,
): TravelGuideSpotItem[] {
  return ranked.slice(0, TRAVEL_GUIDE_NIGHTLIFE_LIST_LIMIT).map((p) => ({
    name: p.name,
    note: formatNightlifeNote(p),
    reason: nightlifeReasonFromPoi(p, eventEndHour),
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
  },
): LlmTravelGuidePayload {
  const room =
    input.headcount <= 1
      ? '单人入住'
      : input.headcount === 2
        ? '双床/大床房即可'
        : `建议 ${Math.ceil(input.headcount / 2)} 间房`;
  const nightLabel = `${input.accommodationNights} 晚`;
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
    );
  }

  const documentItems =
    regionKind !== 'domestic'
      ? buildTravelGuideDocumentItems({
          activity: input.activity,
          destinationCity: destCity,
        })
      : undefined;

  const essentials = buildTravelGuideEssentials({
    activity: input.activity,
    destinationCity: destCity,
    interCity,
  });

  const transitDetailLines = ctx.transitDetail?.detailLines;
  const transportRoute = resolveMapTransportRoute(
    ctx,
    input.selfDrive,
    interCity,
  );

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
    ),
    hotels,
    accommodationSchemes: schemes,
    parkingLines: input.selfDrive
      ? buildParkingLinesFromMap(ranked.parking, ctx.venue.title)
      : undefined,
    nightlifeSpots: nightlifeFromRanked(ranked.nightlife, ctx.eventEndHour),
    tipItems: needsAccommodation
      ? regionKind !== 'domestic'
        ? [
            '散场与夜宵点位来自精选推荐；住宿优先 RollingGo 实时查询，无报价时展示场馆周边精选参考，下单前请在 OTA 核实价格与房态。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
          ]
        : [
            '以上交通、住宿与散场点位来自高德地图周边检索，并结合预算与距离智能排序。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
            '酒店与餐厅评分以地图平台展示为准，下单前建议在 OTA 再确认价格与房态。',
          ]
      : regionKind !== 'domestic'
        ? [
            '散场与夜宵点位来自精选推荐，并结合距离智能排序。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
          ]
        : [
            '以上交通与散场点位来自高德地图周边检索，并结合距离智能排序。',
            '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
          ],
    documentItems,
    ticketChannels: buildTicketChannels(input.activity),
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
    }),
    budgetItems: buildTravelGuideBudgetItems({
      budgetTier: ranked.budgetTier,
      headcount: input.headcount,
      accommodationNights: input.accommodationNights,
      interCity,
      regionKind,
      selfDrive: input.selfDrive,
    }),
  };
}

function formatNightlifeNote(p: RankedMapPoi): string {
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
): string {
  if (schemeHotels?.length) {
    const index = schemeHotels.findIndex((h) => h.name === p.name);
    if (index >= 0) {
      return tierAccommodationSchemeReason(p, budgetTier, index);
    }
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

function nightlifeReasonFromPoi(p: RankedMapPoi, eventEndHour: number): string {
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
