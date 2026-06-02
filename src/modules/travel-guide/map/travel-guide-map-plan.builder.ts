import type {
  LlmTravelGuidePayload,
  TravelGuideHotelItem,
  TravelGuideSpotItem,
} from '../domain/travel-guide.types';
import type {
  DrivingRouteSummary,
  RankedMapPoi,
  TravelGuideMapContext,
  TravelGuideRankedCandidates,
} from './travel-guide-map.types';

export function buildTransportLinesFromMap(
  departure: string,
  venueTitle: string,
  venueReadableAddress: string,
  selfDrive: boolean,
  route?: DrivingRouteSummary,
  hints: string[] = [],
  interCity = false,
): string[] {
  const lines = [
    `建议提前 1 天从「${departure}」出发，前往 ${venueReadableAddress || venueTitle}，预留转场与入住缓冲。`,
  ];

  if (interCity) {
    for (const hint of hints) {
      if (hint && !lines.includes(hint)) lines.push(hint);
    }
    const lastMile = route && route.distanceKm > 0 && route.distanceKm < 120;
    if (lastMile && !selfDrive) {
      lines.push(
        `抵深后接驳参考：枢纽至场馆约 ${route.distanceKm} km / ${route.durationMin} 分钟（打车或地铁，高峰多预留）。`,
      );
    } else if (selfDrive && route && route.distanceKm >= 120) {
      lines.push(
        `全程自驾参考：约 ${route.distanceKm} km / ${route.durationMin} 分钟（以出发日路况为准）。`,
      );
    }
    if (!lines.some((l) => l.includes('散场') || l.includes('返程'))) {
      lines.push('散场时段优先预约网约车；城际返程票建议提前购买。');
    }
    return lines;
  }

  if (selfDrive && route) {
    lines.push(
      `自驾：腾讯地图驾车约 ${route.distanceKm} km / ${route.durationMin} 分钟（以出发日路况为准）。`,
      '散场后场馆周边易拥堵，请提前确认停车场与离场路线。',
    );
  } else if (selfDrive) {
    lines.push(`自驾导航「${venueTitle}」，出发前在腾讯地图查看实时路况。`);
  } else if (route) {
    lines.push(
      `公共交通+打车：参考行程约 ${route.distanceKm} km / ${route.durationMin} 分钟，高峰请多预留时间。`,
      '散场时段优先预约网约车；返程票建议提前购买。',
    );
  } else {
    lines.push(
      `抵达后打车/地铁前往「${venueTitle}」，高峰建议预留 40–60 分钟。`,
    );
  }

  for (const hint of hints) {
    if (hint && !lines.includes(hint)) lines.push(hint);
  }
  return lines;
}

export function buildParkingLinesFromMap(
  ranked: RankedMapPoi[],
  venueTitle: string,
): string[] {
  const top = ranked.slice(0, 2);
  if (!top.length) {
    return [
      `导航「${venueTitle}」并在腾讯地图搜索「停车场」，活动日建议提前 1–2 小时抵达。`,
    ];
  }

  return top.map(
    (p) =>
      `「${p.name}」距会场约 ${formatKm(p.distanceM)} · ${p.address || '详见腾讯地图'}`,
  );
}

export function hotelsFromRanked(
  ranked: RankedMapPoi[],
  nightLabel: string,
  roomHint: string,
  priceBands: [string, string],
): TravelGuideHotelItem[] {
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
      bookingHint: '携程 / 美团',
    };
  });
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

export function mapCandidatesToLlmFallback(
  ctx: TravelGuideMapContext,
  ranked: TravelGuideRankedCandidates,
  input: {
    departure: string;
    selfDrive: boolean;
    accommodationNights: number;
    headcount: number;
  },
): LlmTravelGuidePayload {
  const room =
    input.headcount <= 1
      ? '单人入住'
      : input.headcount === 2
        ? '双床/大床房即可'
        : `建议 ${Math.ceil(input.headcount / 2)} 间房`;
  const nightLabel = `${input.accommodationNights} 晚`;

  return {
    transportLines: buildTransportLinesFromMap(
      input.departure,
      ctx.venue.title,
      ctx.venueReadableAddress,
      input.selfDrive,
      ctx.drivingRoute ?? ctx.transitRoute,
      ctx.transportHints,
      Boolean(ctx.interCity),
    ),
    hotels: hotelsFromRanked(
      ranked.hotels,
      nightLabel,
      room,
      ranked.hotelPriceBand,
    ),
    parkingLines: input.selfDrive
      ? buildParkingLinesFromMap(ranked.parking, ctx.venue.title)
      : undefined,
    nightlifeSpots: nightlifeFromRanked(ranked.nightlife),
    tipItems: [
      '以上交通、住宿与散场点位来自腾讯地图实时检索，并结合预算与距离智能排序。',
      '散场后优先选择仍在营业的夜宵点；凌晨离场注意安全结伴。',
      '酒店与餐厅评分以地图平台展示为准，下单前建议在 OTA 再确认价格与房态。',
    ],
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
