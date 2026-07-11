import type { NormalizedMoney } from './normalized-flight-option';

export interface NormalizedHotelOption {
  id: string;
  provider: string;
  name: string;
  latitude?: number;
  longitude?: number;
  starRating?: number;
  reviewScore?: number;
  distanceToFestivalKm?: number;
  travelTimeToFestivalMinutes?: number;
  address?: string;
  price?: {
    totalAmount: number;
    nightlyAmount?: number;
    currency: NormalizedMoney['currency'];
  };
  bookingUrl?: string;
  searchedAt?: string;
  expiresAt?: string;
  /** Verified content returned by the hotel detail endpoint. */
  amenities?: string[];
  description?: string;
  /** 0–1 cancellation flexibility; defaults to neutral when omitted */
  cancellationFlexibility?: number;
  /** 0–1 supplier trust; defaults derived from provider when omitted */
  supplierTrust?: number;
}
