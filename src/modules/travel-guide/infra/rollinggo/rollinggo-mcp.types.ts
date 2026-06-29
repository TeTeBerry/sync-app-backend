export type RollingGoMcpCallOptions = {
  /** forceRegenerate — bypass in-process quote cache */
  skipCache?: boolean;
};

export interface RollingGoMcpTextContent {
  type: 'text';
  text: string;
}

export interface RollingGoAirportRecord {
  iataCode?: string;
  airportCode?: string;
  name?: string;
  airportName?: string;
  cityCode?: string;
  cityName?: string;
  subType?: string;
}

export interface RollingGoFlightSegmentRecord {
  flightNumber?: string;
  depTime?: string;
  arrTime?: string;
  depAirport?: string;
  arrAirport?: string;
  duration?: number;
  stopCities?: string;
}

export interface RollingGoFlightOfferRecord {
  price?: string;
  totalAdultPrice?: number;
  currency?: string;
  bookableSeats?: string | number;
  airlines?: string;
  validatingCarrier?: string;
  fromSegments?: RollingGoFlightSegmentRecord[];
  retSegments?: RollingGoFlightSegmentRecord[];
  itineraries?: Array<{
    type?: string;
    duration?: string;
    stops?: string;
    segments?: string;
    outboundRoute?: string;
    returnRoute?: string;
    outboundStops?: string;
    returnStops?: string;
    isOutboundDirect?: boolean;
  }>;
}

export interface RollingGoHotelRecord {
  hotelId?: number | string;
  name?: string;
  minPrice?: number;
  maxPrice?: number;
  price?: number | string;
  starRating?: number;
  address?: string;
  bookingUrl?: string;
  lat?: number;
  lng?: number;
  /** RollingGo 返回的直线距离（米），POI 搜索时有效 */
  distanceM?: number;
}
