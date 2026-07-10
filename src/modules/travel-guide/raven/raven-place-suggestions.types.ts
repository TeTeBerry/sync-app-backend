export type RavenPlaceSuggestionKind = 'city' | 'airport';

export interface OpenFlightsAirportRecord {
  id: number;
  name: string;
  city: string;
  country: string;
  iata: string;
  icao: string;
  lat: number;
  lng: number;
  type: string;
}

export interface RavenPlaceSuggestion {
  kind: RavenPlaceSuggestionKind;
  /** Display label for the suggestion row */
  title: string;
  city: string;
  country: string;
  iata?: string;
  icao?: string;
  airportName?: string;
  lat?: number;
  lng?: number;
}

/** Primary remote mirror (jsDelivr is more reachable than raw.githubusercontent in many regions). */
export const OPENFLIGHTS_AIRPORTS_URL =
  'https://cdn.jsdelivr.net/gh/jpatokal/openflights@master/data/airports.dat';

/** Extra remotes tried after the configured/primary URL fails. */
export const OPENFLIGHTS_AIRPORTS_FALLBACK_URLS = [
  'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat',
] as const;
