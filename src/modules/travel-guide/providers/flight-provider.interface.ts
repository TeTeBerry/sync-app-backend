import type { NormalizedFlightOption } from '../types/normalized-flight-option';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';

export interface FlightSearchInput {
  departureText: string;
  departureCity?: string;
  destinationCity: string;
  outboundDate: string;
  returnDate?: string;
  /** Raven-selected window takes precedence over manually supplied dates. */
  recommendedDepartureDate?: string;
  recommendedReturnDate?: string;
  headcount: number;
  budgetTier: TravelGuideBudgetTier;
  regionKind: 'domestic' | 'hmt' | 'overseas';
  activityLegacyId?: number;
  activityName?: string;
  activityCode?: string;
  activityArea?: string;
  activityLocation?: string;
  venueTitle?: string;
  venueAddress?: string;
  forceRefresh?: boolean;
}

export const FLIGHT_PROVIDER = Symbol('FLIGHT_PROVIDER');

export interface FlightProvider {
  searchFlights(input: FlightSearchInput): Promise<NormalizedFlightOption[]>;
}
