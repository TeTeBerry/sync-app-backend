import type {
  TravelGuideAccommodationScheme,
  TravelGuideBudgetItem,
  TravelGuideHotelItem,
  TravelGuideSpotItem,
  TravelGuideTicketChannel,
  TravelGuideVenueTransportOption,
} from '@src/shared/travel-guide';

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
