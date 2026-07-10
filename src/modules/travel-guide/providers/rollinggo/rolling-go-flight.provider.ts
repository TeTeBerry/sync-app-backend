import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import {
  ITravelQuotePort,
  TRAVEL_QUOTE_PORT,
} from '../../ports/travel-quote.port';
import type { TravelQuoteQuery } from '../../ports/travel-quote.types';
import {
  dedupeNormalizedFlights,
  normalizeFlightOptionsFromQuote,
} from '../../domain/normalize-flight-options.util';
import type { NormalizedFlightOption } from '../../types/normalized-flight-option';
import type {
  FlightProvider,
  FlightSearchInput,
} from '../flight-provider.interface';

@Injectable()
export class RollingGoFlightProvider implements FlightProvider {
  private readonly logger = new Logger(RollingGoFlightProvider.name);

  constructor(
    @Inject(TRAVEL_QUOTE_PORT)
    private readonly quotePort: ITravelQuotePort,
  ) {}

  async searchFlights(
    input: FlightSearchInput,
  ): Promise<NormalizedFlightOption[]> {
    const query = toTravelQuoteQuery(input);
    try {
      const quote = await this.quotePort.fetchFlightQuoteForTier(
        query,
        input.budgetTier,
        input.forceRefresh ? { skipCache: true } : undefined,
      );
      return dedupeNormalizedFlights(normalizeFlightOptionsFromQuote(quote));
    } catch (error) {
      this.logger.warn(
        `RollingGo flight search failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return [];
    }
  }
}

function toTravelQuoteQuery(input: FlightSearchInput): TravelQuoteQuery {
  return {
    departureText: input.departureText,
    departureCity: input.departureCity,
    destinationCity: input.destinationCity,
    activityLegacyId: input.activityLegacyId,
    activityName: input.activityName,
    activityCode: input.activityCode,
    activityArea: input.activityArea,
    activityLocation: input.activityLocation,
    venueTitle: input.venueTitle ?? input.destinationCity,
    venueAddress: input.venueAddress ?? '',
    regionKind: input.regionKind,
    interCity: true,
    headcount: input.headcount,
    accommodationNights: 0,
    budgetTier: input.budgetTier as TravelGuideBudgetTier,
    outboundDate: input.outboundDate,
    returnDate: input.returnDate,
    selfDrive: false,
  };
}
