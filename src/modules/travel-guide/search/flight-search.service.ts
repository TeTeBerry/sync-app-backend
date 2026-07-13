import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { TravelQuoteEnrichment } from '../ports/travel-quote.types';
import {
  dedupeNormalizedFlights,
  normalizeFlightOptionsFromQuote,
} from '../domain/normalize-flight-options.util';
import type { NormalizedFlightOption } from '../types/normalized-flight-option';
import { resolveFestivalDateWindow } from '../domain/travel-guide-quote-dates.util';
import {
  FLIGHT_PROVIDER,
  type FlightProvider,
  type FlightSearchInput,
} from '../providers/flight-provider.interface';

@Injectable()
export class FlightSearchService {
  private readonly logger = new Logger(FlightSearchService.name);

  constructor(
    @Optional()
    @Inject(FLIGHT_PROVIDER)
    private readonly flightProvider?: FlightProvider,
  ) {}

  async search(input: FlightSearchInput): Promise<NormalizedFlightOption[]> {
    if (!this.flightProvider) {
      this.logger.debug('FlightSearchService: no flight provider registered');
      return [];
    }
    const started = Date.now();
    const searchInput: FlightSearchInput = {
      ...input,
      outboundDate: input.recommendedDepartureDate ?? input.outboundDate,
      returnDate: input.recommendedReturnDate ?? input.returnDate,
    };
    const results = await this.flightProvider.searchFlights(searchInput);
    const normalized = dedupeNormalizedFlights(
      results.filter((f) => f.price.amount > 0),
    );
    this.logger.log(
      `flight search done count=${normalized.length} durationMs=${Date.now() - started} destination=${input.destinationCity}`,
    );
    return normalized;
  }

  /** Normalize enrichment snapshots without re-calling providers. */
  fromEnrichment(
    enrichment: TravelQuoteEnrichment | null | undefined,
    activityDate?: string,
  ): NormalizedFlightOption[] {
    if (!enrichment) return [];
    const fromSelected = normalizeFlightOptionsFromQuote(enrichment.flight);
    const fromTiers = Object.values(enrichment.flightByTier ?? {}).flatMap(
      (quote) => normalizeFlightOptionsFromQuote(quote),
    );
    return filterFlightsForFestivalWindow(
      dedupeNormalizedFlights([...fromSelected, ...fromTiers]),
      activityDate,
    );
  }
}

/** Provider inventory is cleaned before recommendation: priced and festival-safe only. */
export function filterFlightsForFestivalWindow(
  flights: NormalizedFlightOption[],
  activityDate?: string,
): NormalizedFlightOption[] {
  const festival = resolveFestivalDateWindow(activityDate);
  return flights.filter((flight) => {
    if (!Number.isFinite(flight.price.amount) || flight.price.amount <= 0)
      return false;
    if (!festival) return true;
    const arrivalDate = flight.arrivalAt.slice(0, 10);
    if (arrivalDate && arrivalDate > festival.startDate) return false;
    const returnDate = flight.returnDepartureAt?.slice(0, 10);
    return !returnDate || returnDate >= festival.endDate;
  });
}
