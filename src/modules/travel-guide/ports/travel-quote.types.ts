import type {
  TravelGuideBudgetTier,
  TravelGuideFlightOffer,
} from '@sync/travel-guide-contracts';
import type { TravelGuideRegionKind } from '../domain/travel-guide-international.util';

export interface TravelQuoteQuery {
  departureText: string;
  departureCity?: string;
  destinationCity: string;
  activityLegacyId?: number;
  activityName?: string;
  activityCode?: string;
  activityArea?: string;
  activityLocation?: string;
  venueTitle: string;
  venueAddress: string;
  regionKind: TravelGuideRegionKind;
  interCity: boolean;
  headcount: number;
  accommodationNights: number;
  budgetTier: TravelGuideBudgetTier;
  outboundDate: string;
  returnDate?: string;
  selfDrive: boolean;
  locale?: 'zh' | 'en';
}

export interface FlightQuoteSnapshot {
  fromCityCode: string;
  toCityCode: string;
  outboundDate: string;
  returnDate?: string;
  currency: 'CNY' | 'USD';
  minPricePerAdult: number;
  maxPricePerAdult: number;
  sampleLines: string[];
  flightOffers?: TravelGuideFlightOffer[];
  cabinLabel?: string;
  /** 该预算档期望舱位（如超级经济舱），可能与实际查询结果不同 */
  requestedCabinLabel?: string;
  /** 更高舱位无结果、已降级到更低舱位时为 true */
  cabinFallback?: boolean;
  fetchedAt: string;
  source: 'rollinggo';
}

export interface RollingGoHotelRecommendation {
  name: string;
  address?: string;
  minPricePerNight?: number;
  maxPricePerNight?: number;
  starRating?: number;
  bookingUrl?: string;
  /** 距会场直线距离（米） */
  distanceM?: number;
}

export interface HotelQuoteSnapshot {
  minPricePerNight: number;
  maxPricePerNight: number;
  currency: 'CNY' | 'USD';
  sampleCount: number;
  fetchedAt: string;
  source: 'rollinggo';
  /** 境外：RollingGo 酒店列表，用于攻略正文推荐 */
  recommendations?: RollingGoHotelRecommendation[];
}

export interface TravelQuoteEnrichment {
  flight?: FlightQuoteSnapshot;
  flightByTier?: Partial<Record<TravelGuideBudgetTier, FlightQuoteSnapshot>>;
  /** 当前选中档位的酒店报价 */
  hotel?: HotelQuoteSnapshot;
  /** 三档分别查询的 RollingGo 酒店报价（SYNC 经济/舒适/豪华） */
  hotelByTier?: Partial<Record<TravelGuideBudgetTier, HotelQuoteSnapshot>>;
}
