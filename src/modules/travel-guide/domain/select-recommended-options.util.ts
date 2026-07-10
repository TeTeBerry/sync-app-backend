import type { NormalizedFlightOption } from '../types/normalized-flight-option';
import type { NormalizedHotelOption } from '../types/normalized-hotel-option';
import type { NormalizedTicketOption } from '../types/normalized-ticket-option';
import type {
  FlightRecommendationSet,
  HotelRecommendationSet,
} from '../recommendation/recommendation.types';
import type { PlanSelectedOptions } from '../types/plan-generation-context';

/**
 * Precedence for selection:
 * 1. recommendation bestOverall
 * 2. first normalized search result
 * 3. (caller may pass legacy quote-normalized options already in arrays)
 *
 * Does not re-rank or pick cheapest independently.
 */
export function selectOptionsFromRecommendations(input: {
  flights: NormalizedFlightOption[];
  hotels: NormalizedHotelOption[];
  tickets: NormalizedTicketOption[];
  flightRecommendations: FlightRecommendationSet;
  hotelRecommendations: HotelRecommendationSet;
}): PlanSelectedOptions {
  const flightId = input.flightRecommendations.bestOverall?.optionId;
  const hotelId = input.hotelRecommendations.bestOverall?.optionId;

  const flight =
    (flightId ? input.flights.find((f) => f.id === flightId) : undefined) ??
    input.flights[0];

  const hotel =
    (hotelId ? input.hotels.find((h) => h.id === hotelId) : undefined) ??
    input.hotels[0];

  const ticket =
    input.tickets.find((t) => t.availability === 'available') ??
    input.tickets[0];

  return {
    ...(flight ? { flight } : {}),
    ...(hotel ? { hotel } : {}),
    ...(ticket ? { ticket } : {}),
  };
}
