/** RouteStack Hotel SearchDestinations / SearchHotels shapes (OpenAPI). */

export type RouteStackDestinationTypeFilter = 'DESTINATION' | 'HOTEL';

export interface RouteStackDestinationItem {
  id: string;
  fullName?: string;
  type?: string;
  country?: string;
  city?: string | null;
  referenceId?: string | null;
  coordinates?: { lat?: number; long?: number };
  lat?: number;
  long?: number;
}

export interface RouteStackDestinationsResponse {
  success: boolean;
  message?: string | null;
  code?: number;
  result?: RouteStackDestinationItem[] | null;
}

export interface RouteStackRoomOccupancy {
  adults: number;
  children?: number;
  childAges?: number[];
}

export interface RouteStackSearchHotelsRequest {
  destinationId: string;
  checkIn: string;
  checkOut: string;
  rooms: RouteStackRoomOccupancy[];
  lat: number;
  long: number;
  currency?: string;
  destinationType?: string;
  page?: number;
  limit?: number;
  correlationId?: string;
  token?: string;
  nextResultsKey?: string;
}

export interface RouteStackHotelContactAddress {
  line1?: string;
  city?: { name?: string };
  country?: { code?: string; name?: string };
}

export interface RouteStackHotelRecord {
  id?: string;
  name?: string;
  providerName?: string;
  starRating?: number;
  ourprice?: number;
  baseprice?: number;
  saving?: number;
  distance?: number;
  heroImage?: string;
  mainamenity?: string | string[];
  facilities?: Array<string | { name?: string }>;
  reviews?: { count?: number; rating?: number };
  contact?: { address?: RouteStackHotelContactAddress };
  /** Some providers include coords on the listing row. */
  lat?: number;
  latitude?: number;
  long?: number;
  longitude?: number;
}

export interface RouteStackSearchHotelsResult {
  status?: string;
  count?: number;
  currency?: string;
  token?: string;
  correlationId?: string;
  nextResultsKey?: string;
  result?: RouteStackHotelRecord[];
}

export interface RouteStackSearchHotelsResponse {
  success: boolean;
  message?: string | null;
  code?: number;
  result?: RouteStackSearchHotelsResult | null;
}

export interface RouteStackHotelDetailsRequest {
  hotelId: string;
  contentType: 'ALL';
  correlationId: string;
  token: string;
}

/** Detail payload differs by supplier, so retain the response as opaque data. */
export interface RouteStackHotelDetailsResponse {
  success?: boolean;
  message?: string | null;
  code?: number | string;
  result?: unknown;
  token?: string;
}
