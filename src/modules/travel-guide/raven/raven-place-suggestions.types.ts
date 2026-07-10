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

export const OPENFLIGHTS_AIRPORTS_URL =
  'https://raw.githubusercontent.com/jpatokal/openflights/master/data/airports.dat';
