import type { NormalizedHotelOption } from '../types/normalized-hotel-option';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';

export interface HotelSearchInput {
  destinationCity: string;
  checkInDate: string;
  checkOutDate?: string;
  accommodationNights: number;
  headcount: number;
  budgetTier: TravelGuideBudgetTier;
  regionKind: 'domestic' | 'hmt' | 'overseas';
  venue?: { lat: number; lng: number; title?: string };
  activityLegacyId?: number;
  activityName?: string;
  activityCode?: string;
  activityArea?: string;
  activityLocation?: string;
  forceRefresh?: boolean;
  /** Pre-ranked map POIs (domestic) — provider may ignore */
  mapHotels?: Array<{
    id?: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    distanceM?: number;
    rating?: number;
    avgPrice?: number;
  }>;
}

export const HOTEL_PROVIDER = Symbol('HOTEL_PROVIDER');

export interface HotelProvider {
  searchHotels(input: HotelSearchInput): Promise<NormalizedHotelOption[]>;
}
