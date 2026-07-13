export type FlightRecommendationCategory =
  | 'bestOverall'
  | 'cheapest'
  | 'fastest';

export type HotelRecommendationCategory =
  | 'bestOverall'
  | 'bestValue'
  | 'closestPracticalStay'
  | 'premium';

export type FlightReasonCode =
  | 'DIRECT_FLIGHT'
  | 'FEW_STOPS'
  | 'MULTIPLE_STOPS'
  | 'GOOD_ARRIVAL_TIME'
  | 'GOOD_DEPARTURE_TIME'
  | 'PRICE_WITHIN_BALANCED_RANGE'
  | 'LOWEST_PRICE'
  | 'SHORTEST_DURATION'
  | 'LONG_DURATION'
  | 'RELIABLE_SUPPLIER'
  | 'WITHIN_FLIGHT_BUDGET'
  | 'SLIGHTLY_OVER_FLIGHT_BUDGET'
  | 'OVER_FLIGHT_BUDGET'
  | 'CURRENCY_MISMATCH';

export type HotelReasonCode =
  | 'CLOSEST_TO_VENUE'
  | 'BEST_REVIEW_SCORE'
  | 'PRICE_WITHIN_BALANCED_RANGE'
  | 'LOWEST_NIGHTLY_PRICE'
  | 'HIGH_STAR_RATING'
  | 'GOOD_VALUE_SCORE'
  | 'CONVENIENT_TRANSPORT'
  | 'LONG_TRAVEL_TIME'
  | 'FLEXIBLE_CANCELLATION'
  | 'TRUSTED_SUPPLIER'
  | 'WITHIN_HOTEL_BUDGET'
  | 'SLIGHTLY_OVER_HOTEL_BUDGET'
  | 'OVER_HOTEL_BUDGET'
  | 'PREMIUM_OPTION'
  | 'CURRENCY_MISMATCH';

export interface RecommendationResult<
  TCategory extends string,
  TReason extends string,
> {
  optionId: string;
  category: TCategory;
  score: number;
  reasonCodes: TReason[];
}

export interface FlightRecommendationSet {
  bestOverall?: RecommendationResult<
    FlightRecommendationCategory,
    FlightReasonCode
  >;
  cheapest?: RecommendationResult<
    FlightRecommendationCategory,
    FlightReasonCode
  >;
  fastest?: RecommendationResult<
    FlightRecommendationCategory,
    FlightReasonCode
  >;
  ranked: Array<
    RecommendationResult<FlightRecommendationCategory, FlightReasonCode>
  >;
}

export interface HotelRecommendationSet {
  bestOverall?: RecommendationResult<
    HotelRecommendationCategory,
    HotelReasonCode
  >;
  bestValue?: RecommendationResult<
    HotelRecommendationCategory,
    HotelReasonCode
  >;
  closestPracticalStay?: RecommendationResult<
    HotelRecommendationCategory,
    HotelReasonCode
  >;
  premium?: RecommendationResult<HotelRecommendationCategory, HotelReasonCode>;
  ranked: Array<
    RecommendationResult<HotelRecommendationCategory, HotelReasonCode>
  >;
}

/**
 * Relative competitiveness + quality factors (budget fit applied separately).
 * Weights sum to 1.0 before budgetFit blend.
 */
export const FLIGHT_SCORE_WEIGHTS = {
  price: 0.5,
  duration: 0.3,
  stops: 0.2,
} as const;

/** Blend: 70% quality/relative + 30% user budget fit */
export const FLIGHT_BUDGET_FIT_BLEND = 0;

export const HOTEL_SCORE_WEIGHTS = {
  distance: 0.3,
  price: 0.4,
  review: 0.3,
} as const;

export const HOTEL_BUDGET_FIT_BLEND = 0;
