import type { TravelGuidePlan } from '@sync/travel-guide-contracts';

/**
 * Public Raven contract consumed by sync-web's plan result page.
 * Keep internal ranking, quote, and provider fields on the server.
 * Pass through grounded inventory facts (hotel reasons, flight offers,
 * essentials) without inventing new ones.
 */
export type RavenPlanResponse = {
  activityName: string;
  venue: string;
  eventDates: string;
  departure: string;
  headcount: number;
  budgetLabel: string;
  accommodationNights: number;
  selfDrive: boolean;
  recommendedDepartureDate?: string;
  recommendedReturnDate?: string;
  transport: {
    title: string;
    lines: string[];
    flightOffers?: Array<{
      pricePerAdult: number;
      currency: 'CNY' | 'USD';
      outbound: {
        route: string;
        depAirport?: string;
        arrAirport?: string;
        depTime?: string;
        arrTime?: string;
        stopsLabel: string;
      };
      return?: {
        route: string;
        depAirport?: string;
        arrAirport?: string;
        depTime?: string;
        arrTime?: string;
        stopsLabel: string;
      };
      cabinLabel?: string;
    }>;
  };
  accommodation: {
    title: string;
    hotels: Array<{
      name: string;
      note: string;
      reason?: string;
      bookingHint?: string;
    }>;
    schemes?: Array<{
      label: string;
      name: string;
      note: string;
      reason: string;
      bookingHint?: string;
    }>;
  };
  stayGuide?: TravelGuidePlan['stayGuide'];
  parking?: { title: string; lines: string[] };
  nightlife: {
    title: string;
    spots: Array<{ name: string; note: string; reason?: string }>;
  };
  tips: { title: string; items: string[] };
  venueTransport?: {
    title: string;
    options: Array<{ label: string; lines: string[] }>;
  };
  documents?: { title: string; items: string[] };
  tickets?: { title: string; channels: Array<{ name: string; note: string }> };
  essentials?: {
    title: string;
    network: string[];
    payment: string[];
    apps: string[];
  };
  budget?: {
    title: string;
    items: Array<{ label: string; range: string; note?: string }>;
  };
  itinerary?: {
    title: string;
    days: Array<{ label: string; lines: string[] }>;
  };
};

export function presentRavenPlan(plan: TravelGuidePlan): RavenPlanResponse {
  return {
    activityName: plan.activityName,
    venue: plan.venue,
    eventDates: plan.eventDates,
    departure: plan.departure,
    headcount: plan.headcount,
    budgetLabel: plan.budgetLabel,
    accommodationNights: plan.accommodationNights,
    selfDrive: plan.selfDrive,
    ...(plan.recommendedDepartureDate
      ? { recommendedDepartureDate: plan.recommendedDepartureDate }
      : {}),
    ...(plan.recommendedReturnDate
      ? { recommendedReturnDate: plan.recommendedReturnDate }
      : {}),
    transport: {
      title: plan.transport.title,
      lines: [...plan.transport.lines],
      ...(plan.transport.flightOffers?.length
        ? {
            flightOffers: plan.transport.flightOffers.map((offer) => ({
              pricePerAdult: offer.pricePerAdult,
              currency: offer.currency,
              outbound: { ...offer.outbound },
              ...(offer.return ? { return: { ...offer.return } } : {}),
              ...(offer.cabinLabel ? { cabinLabel: offer.cabinLabel } : {}),
              ...(offer.recommendationReason
                ? { recommendationReason: offer.recommendationReason }
                : {}),
            })),
          }
        : {}),
    },
    accommodation: {
      title: plan.accommodation.title,
      hotels: plan.accommodation.hotels.map((hotel) => ({
        name: hotel.name,
        note: hotel.note,
        ...(hotel.reason ? { reason: hotel.reason } : {}),
        ...(hotel.bookingHint ? { bookingHint: hotel.bookingHint } : {}),
      })),
      ...(plan.accommodation.schemes?.length
        ? {
            schemes: plan.accommodation.schemes.map((scheme) => ({
              label: scheme.label,
              name: scheme.name,
              note: scheme.note,
              reason: scheme.reason,
              ...(scheme.bookingHint
                ? { bookingHint: scheme.bookingHint }
                : {}),
            })),
          }
        : {}),
    },
    ...(plan.stayGuide ? { stayGuide: plan.stayGuide } : {}),
    ...(plan.parking
      ? {
          parking: {
            title: plan.parking.title,
            lines: [...plan.parking.lines],
          },
        }
      : {}),
    nightlife: {
      title: plan.nightlife.title,
      spots: plan.nightlife.spots.map((spot) => ({
        name: spot.name,
        note: spot.note,
        ...(spot.reason ? { reason: spot.reason } : {}),
      })),
    },
    tips: {
      title: plan.tips.title,
      items: [...plan.tips.items],
    },
    ...(plan.venueTransport
      ? {
          venueTransport: {
            title: plan.venueTransport.title,
            options: plan.venueTransport.options.map((option) => ({
              label: option.label,
              lines: [...option.lines],
            })),
          },
        }
      : {}),
    ...(plan.documents
      ? {
          documents: {
            title: plan.documents.title,
            items: [...plan.documents.items],
          },
        }
      : {}),
    ...(plan.tickets
      ? {
          tickets: {
            title: plan.tickets.title,
            channels: plan.tickets.channels.map((channel) => ({
              name: channel.name,
              note: channel.note,
            })),
          },
        }
      : {}),
    ...(plan.essentials
      ? {
          essentials: {
            title: plan.essentials.title,
            network: [...plan.essentials.network],
            payment: [...plan.essentials.payment],
            apps: [...plan.essentials.apps],
          },
        }
      : {}),
    ...(plan.budget
      ? {
          budget: {
            title: plan.budget.title,
            items: plan.budget.items.map((item) => ({
              label: item.label,
              range: item.range,
              ...(item.note ? { note: item.note } : {}),
            })),
          },
        }
      : {}),
    ...(plan.itinerary
      ? {
          itinerary: {
            title: plan.itinerary.title,
            days: plan.itinerary.days.map((day) => ({
              label: day.label,
              lines: [...day.lines],
            })),
          },
        }
      : {}),
  };
}
