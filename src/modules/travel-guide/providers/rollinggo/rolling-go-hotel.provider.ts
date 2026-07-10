import { Inject, Injectable, Logger } from '@nestjs/common';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import {
  ITravelQuotePort,
  TRAVEL_QUOTE_PORT,
} from '../../ports/travel-quote.port';
import type { TravelQuoteQuery } from '../../ports/travel-quote.types';
import {
  dedupeNormalizedHotels,
  normalizeHotelOptionsFromMapPois,
  normalizeHotelOptionsFromQuote,
} from '../../domain/normalize-hotel-options.util';
import type { NormalizedHotelOption } from '../../types/normalized-hotel-option';
import type {
  HotelProvider,
  HotelSearchInput,
} from '../hotel-provider.interface';

@Injectable()
export class RollingGoHotelProvider implements HotelProvider {
  private readonly logger = new Logger(RollingGoHotelProvider.name);

  constructor(
    @Inject(TRAVEL_QUOTE_PORT)
    private readonly quotePort: ITravelQuotePort,
  ) {}

  async searchHotels(
    input: HotelSearchInput,
  ): Promise<NormalizedHotelOption[]> {
    if (input.accommodationNights <= 0) {
      return [];
    }

    const mapHotels = input.mapHotels?.length
      ? normalizeHotelOptionsFromMapPois(
          input.mapHotels,
          input.accommodationNights,
          input.regionKind === 'overseas' ? 'USD' : 'CNY',
        )
      : [];

    if (input.regionKind === 'domestic' && mapHotels.length) {
      return dedupeNormalizedHotels(mapHotels);
    }

    const query = toTravelQuoteQuery(input);
    try {
      const quote = await this.quotePort.fetchHotelQuoteForTier(
        query,
        input.budgetTier,
        input.forceRefresh ? { skipCache: true } : undefined,
      );
      const fromQuote = normalizeHotelOptionsFromQuote(
        quote,
        input.accommodationNights,
      );
      return dedupeNormalizedHotels([...fromQuote, ...mapHotels]);
    } catch (error) {
      this.logger.warn(
        `RollingGo hotel search failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return dedupeNormalizedHotels(mapHotels);
    }
  }
}

function toTravelQuoteQuery(input: HotelSearchInput): TravelQuoteQuery {
  return {
    departureText: input.destinationCity,
    destinationCity: input.destinationCity,
    activityLegacyId: input.activityLegacyId,
    activityName: input.activityName,
    activityCode: input.activityCode,
    activityArea: input.activityArea,
    activityLocation: input.activityLocation,
    venueTitle: input.venue?.title ?? input.destinationCity,
    venueAddress: input.activityLocation ?? '',
    regionKind: input.regionKind,
    interCity: true,
    headcount: input.headcount,
    accommodationNights: input.accommodationNights,
    budgetTier: input.budgetTier as TravelGuideBudgetTier,
    outboundDate: input.checkInDate,
    returnDate: input.checkOutDate,
    selfDrive: false,
  };
}
