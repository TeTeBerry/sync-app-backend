import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { TravelQuoteEnrichment } from '../ports/travel-quote.types';
import {
  dedupeNormalizedFlights,
  normalizeFlightOptionsFromQuote,
} from '../domain/normalize-flight-options.util';
import type { NormalizedFlightOption } from '../types/normalized-flight-option';
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
    const results = await this.flightProvider.searchFlights(input);
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
  ): NormalizedFlightOption[] {
    if (!enrichment) return [];
    const fromSelected = normalizeFlightOptionsFromQuote(enrichment.flight);
    const fromTiers = Object.values(enrichment.flightByTier ?? {}).flatMap(
      (quote) => normalizeFlightOptionsFromQuote(quote),
    );
    return dedupeNormalizedFlights([...fromSelected, ...fromTiers]);
  }
}
