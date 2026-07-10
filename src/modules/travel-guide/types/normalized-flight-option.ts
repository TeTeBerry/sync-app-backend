export interface NormalizedMoney {
  amount: number;
  currency: 'CNY' | 'USD';
}

export interface NormalizedFlightOption {
  id: string;
  provider: string;
  originAirportCode: string;
  destinationAirportCode: string;
  departureAt: string;
  arrivalAt: string;
  durationMinutes: number;
  stops: number;
  airlines: string[];
  price: NormalizedMoney;
  bookingUrl?: string;
  searchedAt?: string;
  expiresAt?: string;
  /** Round-trip return leg when available */
  returnDepartureAt?: string;
  returnArrivalAt?: string;
  cabinLabel?: string;
  sampleLine?: string;
  /** 0–1 supplier reliability; defaults derived from provider when omitted */
  supplierReliability?: number;
}
