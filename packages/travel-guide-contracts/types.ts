/** 住宿预算/晚 */
export type TravelGuideBudgetTier = 'economy' | 'standard' | 'comfort';

export interface TravelGuideHotelItem {
  name: string;
  note: string;
  reason?: string;
  bookingHint?: string;
}

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
  reason?: string;
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
  documents?: { title: string; items: string[] };
  tickets?: { title: string; channels: TravelGuideTicketChannel[] };
  essentials?: {
    title: string;
    network: string[];
    payment: string[];
    apps: string[];
  };
  venueTransport?: {
    title: string;
    options: TravelGuideVenueTransportOption[];
  };
  budget?: { title: string; items: TravelGuideBudgetItem[] };
  itinerary?: {
    title: string;
    days: Array<{ label: string; lines: string[] }>;
  };
}
