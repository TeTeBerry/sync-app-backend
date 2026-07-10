import { Inject, Injectable, Logger, Optional } from '@nestjs/common';
import type { TravelQuoteEnrichment } from '../ports/travel-quote.types';
import type { RankedMapPoi } from '../map/travel-guide-map.types';
import {
  dedupeNormalizedHotels,
  normalizeHotelOptionsFromMapPois,
  normalizeHotelOptionsFromQuote,
} from '../domain/normalize-hotel-options.util';
import type { NormalizedHotelOption } from '../types/normalized-hotel-option';
import {
  HOTEL_PROVIDER,
  type HotelProvider,
  type HotelSearchInput,
} from '../providers/hotel-provider.interface';

@Injectable()
export class HotelSearchService {
  private readonly logger = new Logger(HotelSearchService.name);

  constructor(
    @Optional()
    @Inject(HOTEL_PROVIDER)
    private readonly hotelProvider?: HotelProvider,
  ) {}

  async search(input: HotelSearchInput): Promise<NormalizedHotelOption[]> {
    if (input.accommodationNights <= 0) return [];
    if (!this.hotelProvider) {
      if (input.mapHotels?.length) {
        return dedupeNormalizedHotels(
          normalizeHotelOptionsFromMapPois(
            input.mapHotels,
            input.accommodationNights,
          ),
        );
      }
      this.logger.debug('HotelSearchService: no hotel provider registered');
      return [];
    }

    const started = Date.now();
    const results = await this.hotelProvider.searchHotels(input);
    const normalized = dedupeNormalizedHotels(results);
    this.logger.log(
      `hotel search done count=${normalized.length} durationMs=${Date.now() - started} destination=${input.destinationCity}`,
    );
    return normalized;
  }

  fromEnrichment(
    enrichment: TravelQuoteEnrichment | null | undefined,
    accommodationNights: number,
  ): NormalizedHotelOption[] {
    if (!enrichment || accommodationNights <= 0) return [];
    const fromSelected = normalizeHotelOptionsFromQuote(
      enrichment.hotel,
      accommodationNights,
    );
    const fromTiers = Object.values(enrichment.hotelByTier ?? {}).flatMap(
      (quote) => normalizeHotelOptionsFromQuote(quote, accommodationNights),
    );
    return dedupeNormalizedHotels([...fromSelected, ...fromTiers]);
  }

  fromMapRanked(
    hotels: RankedMapPoi[],
    accommodationNights: number,
  ): NormalizedHotelOption[] {
    if (accommodationNights <= 0 || !hotels.length) return [];
    return dedupeNormalizedHotels(
      normalizeHotelOptionsFromMapPois(
        hotels.map((h) => ({
          id: h.id,
          name: h.name,
          address: h.address,
          lat: h.lat,
          lng: h.lng,
          distanceM: h.distanceM,
          rating: h.rating,
          avgPrice: h.avgPrice,
        })),
        accommodationNights,
      ),
    );
  }
}
