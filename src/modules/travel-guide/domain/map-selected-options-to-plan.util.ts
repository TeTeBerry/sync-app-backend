import type {
  TravelGuideFlightOffer,
  TravelGuideHotelItem,
} from '@sync/travel-guide-contracts';
import type { NormalizedFlightOption } from '../types/normalized-flight-option';
import type { NormalizedHotelOption } from '../types/normalized-hotel-option';
import type {
  FlightReasonCode,
  HotelReasonCode,
  FlightRecommendationSet,
  HotelRecommendationSet,
  HotelRecommendationCategory,
  FlightRecommendationCategory,
} from '../recommendation/recommendation.types';

const FLIGHT_REASON_LABEL: Record<FlightReasonCode, string> = {
  DIRECT_FLIGHT: '直飞',
  FEW_STOPS: '经停少',
  MULTIPLE_STOPS: '多次经停',
  GOOD_ARRIVAL_TIME: '到达时段合适',
  GOOD_DEPARTURE_TIME: '出发时段合适',
  PRICE_WITHIN_BALANCED_RANGE: '价格适中',
  LOWEST_PRICE: '价格最低',
  SHORTEST_DURATION: '耗时最短',
  LONG_DURATION: '航程较长',
  RELIABLE_SUPPLIER: '供应商可靠',
  WITHIN_FLIGHT_BUDGET: '符合机票预算',
  SLIGHTLY_OVER_FLIGHT_BUDGET: '略超机票预算',
  OVER_FLIGHT_BUDGET: '超出机票预算',
  CURRENCY_MISMATCH: '币种不一致',
};

const HOTEL_REASON_LABEL: Record<HotelReasonCode, string> = {
  CLOSEST_TO_VENUE: '距会场最近',
  BEST_REVIEW_SCORE: '评分优秀',
  PRICE_WITHIN_BALANCED_RANGE: '价格适中',
  LOWEST_NIGHTLY_PRICE: '每晚最低',
  HIGH_STAR_RATING: '星级较高',
  GOOD_VALUE_SCORE: '性价比高',
  CONVENIENT_TRANSPORT: '交通便利',
  LONG_TRAVEL_TIME: '接驳较远',
  FLEXIBLE_CANCELLATION: '取消政策灵活',
  TRUSTED_SUPPLIER: '供应商可信',
  WITHIN_HOTEL_BUDGET: '符合住宿预算',
  SLIGHTLY_OVER_HOTEL_BUDGET: '略超住宿预算',
  OVER_HOTEL_BUDGET: '超出住宿预算',
  PREMIUM_OPTION: '品质之选',
  CURRENCY_MISMATCH: '币种不一致',
};

export const HOTEL_CATEGORY_LABEL: Record<HotelRecommendationCategory, string> =
  {
    bestOverall: 'Best overall',
    bestValue: 'Best value',
    closestPracticalStay: 'Closest practical stay',
    premium: 'Premium option',
  };

export const FLIGHT_CATEGORY_LABEL: Record<
  FlightRecommendationCategory,
  string
> = {
  bestOverall: 'Best overall',
  cheapest: 'Lowest price',
  fastest: 'Fastest route',
};

export function formatFlightReasonCodes(codes: FlightReasonCode[]): string {
  return codes.map((c) => FLIGHT_REASON_LABEL[c] ?? c).join(' · ');
}

export function formatHotelReasonCodes(codes: HotelReasonCode[]): string {
  return codes.map((c) => HOTEL_REASON_LABEL[c] ?? c).join(' · ');
}

export function normalizedFlightToOffer(
  flight: NormalizedFlightOption,
  category?: FlightRecommendationCategory,
): TravelGuideFlightOffer {
  const stopsLabel =
    flight.stops <= 0
      ? '直飞'
      : flight.stops === 1
        ? '1 次经停'
        : `${flight.stops} 次经停`;
  const categoryLabel = category ? FLIGHT_CATEGORY_LABEL[category] : undefined;
  return {
    pricePerAdult: flight.price.amount,
    currency: flight.price.currency,
    cabinLabel: categoryLabel
      ? flight.cabinLabel
        ? `${categoryLabel} · ${flight.cabinLabel}`
        : categoryLabel
      : flight.cabinLabel,
    outbound: {
      route: `${flight.originAirportCode}-${flight.destinationAirportCode}`,
      depAirport: flight.originAirportCode,
      arrAirport: flight.destinationAirportCode,
      depTime: flight.departureAt,
      arrTime: flight.arrivalAt,
      stopsLabel,
      flightNumbers: flight.airlines.length ? flight.airlines : undefined,
    },
    ...(flight.returnDepartureAt
      ? {
          return: {
            route: `${flight.destinationAirportCode}-${flight.originAirportCode}`,
            depAirport: flight.destinationAirportCode,
            arrAirport: flight.originAirportCode,
            depTime: flight.returnDepartureAt,
            arrTime: flight.returnArrivalAt,
            stopsLabel,
          },
        }
      : {}),
  };
}

export function normalizedHotelToGuideItem(
  hotel: NormalizedHotelOption,
  input: {
    nights: number;
    headcount: number;
    reasonCodes?: HotelReasonCode[];
    category?: HotelRecommendationCategory;
    isPrimary?: boolean;
  },
): TravelGuideHotelItem {
  const nightly = hotel.price?.nightlyAmount ?? hotel.price?.totalAmount;
  const currency = hotel.price?.currency ?? 'CNY';
  const priceLabel =
    nightly != null && nightly > 0
      ? currency === 'USD'
        ? `约 $${Math.round(nightly)}/晚`
        : `起步约 ¥${Math.round(nightly)}/晚`
      : '价格以实时查询为准';
  const dist =
    hotel.distanceToFestivalKm != null
      ? ` · 距会场约 ${hotel.distanceToFestivalKm} km`
      : '';
  const star =
    hotel.starRating != null && hotel.starRating > 0
      ? ` · ${hotel.starRating} 星`
      : '';
  const rooms = input.headcount <= 1 ? 1 : Math.ceil(input.headcount / 2);
  const reason = input.reasonCodes?.length
    ? formatHotelReasonCodes(input.reasonCodes)
    : input.isPrimary
      ? '综合推荐'
      : '备选酒店';

  return {
    name: hotel.name,
    note: `${priceLabel}${star}${dist} · ${input.nights} 晚 · ${input.headcount} 人 · 建议 ${rooms} 间`,
    reason,
    bookingHint: hotel.bookingUrl
      ? '参考预订链接 · 以 OTA 实时为准'
      : undefined,
  };
}

/**
 * Build at most 4 hotel rows from recommendation categories
 * (Best overall / Best value / Closest / Premium) — never the full search pool.
 */
export function buildHotelItemsFromRecommendations(input: {
  hotels: NormalizedHotelOption[];
  hotelRecommendations: HotelRecommendationSet;
  selectedHotelId?: string;
  nights: number;
  headcount: number;
}): TravelGuideHotelItem[] {
  const byId = new Map(input.hotels.map((h) => [h.id, h]));
  const items: TravelGuideHotelItem[] = [];
  const seen = new Set<string>();

  const categoryOrder: HotelRecommendationCategory[] = [
    'bestOverall',
    'bestValue',
    'closestPracticalStay',
    'premium',
  ];

  const push = (
    id: string | undefined,
    category: HotelRecommendationCategory,
    isPrimary: boolean,
  ) => {
    if (!id || seen.has(id)) return;
    const hotel = byId.get(id);
    if (!hotel) return;
    seen.add(id);
    const rec =
      input.hotelRecommendations[category] ??
      input.hotelRecommendations.ranked.find((r) => r.optionId === id);
    items.push(
      normalizedHotelToGuideItem(hotel, {
        nights: input.nights,
        headcount: input.headcount,
        reasonCodes: rec?.reasonCodes,
        category,
        isPrimary,
      }),
    );
  };

  // Prefer selected (= bestOverall) first, then remaining category slots.
  if (input.selectedHotelId) {
    push(input.selectedHotelId, 'bestOverall', true);
  }
  for (const category of categoryOrder) {
    push(input.hotelRecommendations[category]?.optionId, category, false);
  }
  return items;
}

export function buildHotelSchemesFromRecommendations(input: {
  hotels: NormalizedHotelOption[];
  hotelRecommendations: HotelRecommendationSet;
  selectedHotelId?: string;
  nights: number;
  headcount: number;
}): Array<{
  label: string;
  name: string;
  note: string;
  reason: string;
  bookingHint?: string;
}> {
  const byId = new Map(input.hotels.map((h) => [h.id, h]));
  const schemes: Array<{
    label: string;
    name: string;
    note: string;
    reason: string;
    bookingHint?: string;
  }> = [];
  const seen = new Set<string>();

  const categoryOrder: HotelRecommendationCategory[] = [
    'bestOverall',
    'bestValue',
    'closestPracticalStay',
    'premium',
  ];

  for (const category of categoryOrder) {
    const id =
      category === 'bestOverall' && input.selectedHotelId
        ? input.selectedHotelId
        : input.hotelRecommendations[category]?.optionId;
    if (!id || seen.has(id)) continue;
    const hotel = byId.get(id);
    if (!hotel) continue;
    seen.add(id);
    const rec = input.hotelRecommendations[category];
    const item = normalizedHotelToGuideItem(hotel, {
      nights: input.nights,
      headcount: input.headcount,
      reasonCodes: rec?.reasonCodes,
      category,
      isPrimary: category === 'bestOverall',
    });
    schemes.push({
      label: HOTEL_CATEGORY_LABEL[category],
      name: item.name,
      note: item.note,
      reason: item.reason ?? HOTEL_CATEGORY_LABEL[category],
      bookingHint: item.bookingHint,
    });
  }
  return schemes;
}

/** Up to 3 flight offers: Best overall / Lowest price / Fastest route. */
export function buildFlightOffersFromRecommendations(input: {
  flights: NormalizedFlightOption[];
  flightRecommendations: FlightRecommendationSet;
  selectedFlightId?: string;
}): TravelGuideFlightOffer[] {
  const byId = new Map(input.flights.map((f) => [f.id, f]));
  const offers: TravelGuideFlightOffer[] = [];
  const seen = new Set<string>();

  const push = (
    id: string | undefined,
    category: FlightRecommendationCategory,
  ) => {
    if (!id || seen.has(id)) return;
    const flight = byId.get(id);
    if (!flight) return;
    seen.add(id);
    offers.push(normalizedFlightToOffer(flight, category));
  };

  push(
    input.selectedFlightId ?? input.flightRecommendations.bestOverall?.optionId,
    'bestOverall',
  );
  push(input.flightRecommendations.cheapest?.optionId, 'cheapest');
  push(input.flightRecommendations.fastest?.optionId, 'fastest');
  return offers;
}

export function buildFlightSampleLine(
  flight: NormalizedFlightOption,
  reasonCodes?: FlightReasonCode[],
  category?: FlightRecommendationCategory,
): string {
  const reason = reasonCodes?.length
    ? `（${formatFlightReasonCodes(reasonCodes)}）`
    : '';
  const prefix = category ? `${FLIGHT_CATEGORY_LABEL[category]} · ` : '';
  if (flight.sampleLine?.trim()) {
    return `${prefix}${flight.sampleLine.trim()}${reason}`;
  }
  const price =
    flight.price.currency === 'USD'
      ? `$${Math.round(flight.price.amount)}`
      : `¥${Math.round(flight.price.amount)}`;
  return `${prefix}${flight.originAirportCode}→${flight.destinationAirportCode} · ${price}/人起${reason}`;
}
