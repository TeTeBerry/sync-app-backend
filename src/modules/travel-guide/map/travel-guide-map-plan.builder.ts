import type { Activity } from '../../../database/schemas/activity.schema';
import type {
  LlmTravelGuidePayload,
  TravelGuideAccommodationScheme,
  TravelGuideHotelItem,
  TravelGuideSpotItem,
  TravelGuideTicketChannel,
} from '../domain/travel-guide.types';
import { buildTravelGuideBudgetItems } from '../domain/travel-guide-budget-estimate.util';
import {
  buildTravelGuideDocumentItems,
  buildTravelGuideEssentials,
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

const NEARBY_SCHEME_REASON =
  '距会场最近，散场后回程最短，适合连刷多日、不想早起赶路或想最大化在场时间的 Raver。';
const CITY_CENTER_SCHEME_REASON =
  '市中心/商圈配套更全，餐饮购物与次日出行方便，适合首次到访、想兼顾城市体验的玩家。';

export function buildTransportLinesFromMap(
  departure: string,
  venueTitle: string,
  venueReadableAddress: string,
  selfDrive: boolean,
  route?: DrivingRouteSummary,
  hints: string[] = [],
  interCity = false,
  activity?: Activity,
): string[] {
  return buildInterCityTransportLines({
    departure,
    venueTitle,
    venueReadableAddress,
    selfDrive,
    interCity,
    route,
    transportHints: hints,
    destinationCity: activity
      ? destinationCityFromActivityLocation(activity.location)
      : undefined,
    activity,
  });
}

export { buildVenueTransportOptions } from '../domain/travel-guide-transport.util';

export function buildTicketChannels(
  activity: Pick<Activity, 'name' | 'externalUrl'>,
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
    {
      name: 'Klook / Trip.com（境外场）',
      note: 'EDC Thailand、Tomorrowland 等境外场常用，含 Shuttle 套票选项。',
    },
  );

  return channels.slice(0, 4);
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
): TravelGuideHotelItem[] {
  const bookingHint = activity
    ? travelGuideHotelBookingHint(activity)
    : '携程 / 美团';
  const picked = ranked.slice(0, 3);
  if (!picked.length) return [];

  return picked.map((p, index) => {
    const band = index === 0 ? priceBands[0] : priceBands[1];
    const ratingText = p.rating != null ? ` · 评分 ${p.rating}` : '';
    const distanceText =
      p.distanceLabel?.trim() || `距会场约 ${formatKm(p.distanceM)}`;
    return {
      name: p.name,
      note: `起步约 ¥${p.avgPrice ?? band}/晚 · ${distanceText}${ratingText} · ${nightLabel} · ${roomHint}`,
      bookingHint,
    };
  });
}

export function accommodationSchemesFromRanked(
  picks: { nearby: RankedMapPoi; cityCenter: RankedMapPoi },
  nightLabel: string,
  roomHint: string,
  priceBands: [string, string],
  activity?: Pick<Activity, 'region'>,
): TravelGuideAccommodationScheme[] {
  const bookingHint = activity
    ? travelGuideHotelBookingHint(activity)
    : '携程 / 美团 / 飞猪';
  return [
    schemeFromPoi(
      picks.nearby,
      '就近方案',
      NEARBY_SCHEME_REASON,
      nightLabel,
      roomHint,
      priceBands[0],
      bookingHint,
    ),
    schemeFromPoi(
      picks.cityCenter,
      '市中心方案',
      CITY_CENTER_SCHEME_REASON,
      nightLabel,
      roomHint,
      priceBands[1],
      bookingHint,
    ),
  ];
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
): TravelGuideSpotItem[] {
  return ranked.slice(0, 4).map((p) => ({
    name: p.name,
    note: formatNightlifeNote(p),
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
      bookingHint: polished.bookingHint?.trim() || hotel.bookingHint,
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

  const schemes = ranked.accommodationPicks
    ? accommodationSchemesFromRanked(
        ranked.accommodationPicks,
        nightLabel,
        room,
        ranked.hotelPriceBand,
        input.activity,
      )
    : accommodationSchemesFromRanked(
        {
          nearby: ranked.hotels[0]!,
          cityCenter: ranked.hotels[1] ?? ranked.hotels[0]!,
        },
        nightLabel,
        room,
        ranked.hotelPriceBand,
        input.activity,
      );

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

  return {
    transportLines: buildTransportLinesFromMap(
      input.departure,
      ctx.venue.title,
      ctx.venueReadableAddress,
      input.selfDrive,
      ctx.drivingRoute ?? ctx.transitRoute,
      ctx.transportHints,
      interCity,
      input.activity,
    ),
    hotels: schemes.map((s) => ({
      name: s.name,
      note: s.note,
      bookingHint: s.bookingHint,
    })),
    accommodationSchemes: schemes,
    parkingLines: input.selfDrive
      ? buildParkingLinesFromMap(ranked.parking, ctx.venue.title)
      : undefined,
    nightlifeSpots: nightlifeFromRanked(ranked.nightlife),
    tipItems: [
      '以上交通、住宿与散场点位来自高德地图周边检索，并结合预算与距离智能排序。',
      '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
      '酒店与餐厅评分以地图平台展示为准，下单前建议在 OTA 再确认价格与房态。',
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
      route: ctx.drivingRoute ?? ctx.transitRoute,
      transportHints: ctx.transportHints,
      destinationCity: destCity,
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

function formatKm(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(1)}km`;
}
