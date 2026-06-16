export type TravelGuideBudgetTier = 'economy' | 'standard' | 'comfort';

export interface TravelGuideHotelItem {
  name: string;
  note: string;
  bookingHint?: string;
}

/** 住宿双方案：就近 vs 市中心，各含推荐理由 */
export interface TravelGuideAccommodationScheme {
  label: string;
  name: string;
  note: string;
  reason: string;
  bookingHint?: string;
}

export interface TravelGuideSpotItem {
  name: string;
  note: string;
}

export interface TravelGuideTicketChannel {
  name: string;
  note: string;
}

export interface TravelGuideVenueTransportOption {
  label: string;
  lines: string[];
}

export interface TravelGuideBudgetItem {
  label: string;
  range: string;
  note?: string;
}

export interface TravelGuidePlan {
  activityName: string;
  venue: string;
  eventDates: string;
  departure: string;
  headcount: number;
  budgetLabel: string;
  accommodationNights: number;
  selfDrive: boolean;
  transport: { title: string; lines: string[] };
  accommodation: {
    title: string;
    hotels: TravelGuideHotelItem[];
    schemes?: TravelGuideAccommodationScheme[];
  };
  parking?: { title: string; lines: string[] };
  nightlife: { title: string; spots: TravelGuideSpotItem[] };
  tips: { title: string; items: string[] };
  /** 出国/港澳台：证件与入境必备 */
  documents?: { title: string; items: string[] };
  /** 门票购买渠道 */
  tickets?: { title: string; channels: TravelGuideTicketChannel[] };
  /** 网络、支付、必备 App */
  essentials?: {
    title: string;
    network: string[];
    payment: string[];
    apps: string[];
  };
  /** 抵达会场交通全方案 */
  venueTransport?: {
    title: string;
    options: TravelGuideVenueTransportOption[];
  };
  /** 全项预算参考 */
  budget?: { title: string; items: TravelGuideBudgetItem[] };
}

export interface LlmTravelGuidePayload {
  transportLines: string[];
  hotels: TravelGuideHotelItem[];
  accommodationSchemes?: TravelGuideAccommodationScheme[];
  parkingLines?: string[];
  nightlifeSpots: TravelGuideSpotItem[];
  tipItems: string[];
  documentItems?: string[];
  ticketChannels?: TravelGuideTicketChannel[];
  essentials?: {
    network: string[];
    payment: string[];
    apps: string[];
  };
  venueTransportOptions?: TravelGuideVenueTransportOption[];
  budgetItems?: TravelGuideBudgetItem[];
}
