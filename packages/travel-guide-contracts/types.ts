/** 住宿预算/晚 */
export type TravelGuideBudgetTier = 'economy' | 'standard' | 'comfort';

/** 由实际酒店查询价动态划分的档位 nightly 区间 */
export interface TravelGuideBudgetTierSnapshot {
  tier: TravelGuideBudgetTier;
  nightlyMin: number;
  nightlyMax: number;
  currency?: 'CNY' | 'USD';
}

export interface TravelGuideHotelItem {
  name: string;
  note: string;
  reason?: string;
  bookingHint?: string;
}

export interface TravelGuideAccommodationScheme {
  label: string;
  name: string;
  note: string;
  reason: string;
  bookingHint?: string;
}

export interface TravelGuideSpotItem {
  name: string;
  note: string;
  reason?: string;
}

export interface TravelGuideTicketChannel {
  name: string;
  note: string;
}

export interface TravelGuideVenueTransportOption {
  label: string;
  lines: string[];
}

/** RollingGo 参考航班的单程航段 */
export interface TravelGuideFlightLeg {
  route: string;
  depAirport?: string;
  arrAirport?: string;
  depTime?: string;
  arrTime?: string;
  stopsLabel: string;
  flightNumbers?: string[];
}

/** RollingGo 参考航班（往返） */
export interface TravelGuideFlightOffer {
  pricePerAdult: number;
  currency: 'CNY' | 'USD';
  outbound: TravelGuideFlightLeg;
  return?: TravelGuideFlightLeg;
  /** 舱位说明，如「经济舱」「公务舱」 */
  cabinLabel?: string;
}

/** 各预算档 RollingGo 机票参考价（舱位不同） */
export interface TravelGuideFlightTierQuote {
  cabinLabel: string;
  minPricePerAdult: number;
  maxPricePerAdult: number;
  currency: 'CNY' | 'USD';
  flightOffers?: TravelGuideFlightOffer[];
  sampleLines?: string[];
  fromCityCode?: string;
  toCityCode?: string;
  /** 该档期望舱位（如超级经济舱） */
  requestedCabinLabel?: string;
  /** 更高舱位无结果、已降级展示时为 true */
  cabinFallback?: boolean;
}

/** 各预算档 RollingGo 酒店推荐（切换档位时展示） */
export interface TravelGuideHotelTierAccommodation {
  hotels: TravelGuideHotelItem[];
  schemes?: TravelGuideAccommodationScheme[];
}

export interface TravelGuideBudgetItem {
  label: string;
  range: string;
  note?: string;
  /** RollingGo 等来源的明细行（如参考航班） */
  details?: string[];
}

export interface TravelGuidePlan {
  activityName: string;
  venue: string;
  eventDates: string;
  departure: string;
  headcount: number;
  budgetLabel: string;
  accommodationNights: number;
  selfDrive: boolean;
  transport: {
    title: string;
    lines: string[];
    /** RollingGo 结构化参考航班（有则优先卡片展示） */
    flightOffers?: TravelGuideFlightOffer[];
  };
  accommodation: {
    title: string;
    hotels: TravelGuideHotelItem[];
    schemes?: TravelGuideAccommodationScheme[];
  };
  parking?: { title: string; lines: string[] };
  nightlife: { title: string; spots: TravelGuideSpotItem[] };
  tips: { title: string; items: string[] };
  documents?: { title: string; items: string[] };
  tickets?: { title: string; channels: TravelGuideTicketChannel[] };
  essentials?: {
    title: string;
    network: string[];
    payment: string[];
    apps: string[];
  };
  venueTransport?: {
    title: string;
    options: TravelGuideVenueTransportOption[];
  };
  budget?: { title: string; items: TravelGuideBudgetItem[] };
  /** 经济/舒适/豪华三档 nightly 价区间（来自酒店查询，非写死模板） */
  budgetTierSnapshots?: TravelGuideBudgetTierSnapshot[];
  /** RollingGo 报价最近一次成功写入 plan 的时间（ISO） */
  quoteFetchedAt?: string;
  /** 各预算档酒店报价来源：rollinggo 实查 / estimated 估算 */
  quoteTierSources?: Partial<
    Record<TravelGuideBudgetTier, 'rollinggo' | 'estimated'>
  >;
  /** 经济/舒适/豪华三档机票参考（舱位不同） */
  flightByTier?: Partial<
    Record<TravelGuideBudgetTier, TravelGuideFlightTierQuote>
  >;
  /** 经济/舒适/豪华三档酒店推荐（RollingGo 实查） */
  hotelByTier?: Partial<
    Record<TravelGuideBudgetTier, TravelGuideHotelTierAccommodation>
  >;
  itinerary?: {
    title: string;
    days: Array<{ label: string; lines: string[] }>;
  };
}
