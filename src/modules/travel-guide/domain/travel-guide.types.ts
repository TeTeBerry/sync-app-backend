export type TravelGuideBudgetTier = 'economy' | 'standard' | 'comfort';

export interface TravelGuideHotelItem {
  name: string;
  note: string;
  bookingHint?: string;
}

export interface TravelGuideSpotItem {
  name: string;
  note: string;
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
  accommodation: { title: string; hotels: TravelGuideHotelItem[] };
  parking?: { title: string; lines: string[] };
  nightlife: { title: string; spots: TravelGuideSpotItem[] };
  tips: { title: string; items: string[] };
}

export interface LlmTravelGuidePayload {
  transportLines: string[];
  hotels: TravelGuideHotelItem[];
  parkingLines?: string[];
  nightlifeSpots: TravelGuideSpotItem[];
  tipItems: string[];
}
