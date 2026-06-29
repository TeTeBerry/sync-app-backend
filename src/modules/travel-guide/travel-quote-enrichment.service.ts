import { Inject, Injectable } from '@nestjs/common';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import {
  buildTravelQuoteQuery,
  type TravelQuoteActivity,
} from './domain/travel-guide-quote.util';
import type { TravelGuideMapContext } from './map/travel-guide-map.types';
import type {
  HotelQuoteSnapshot,
  TravelQuoteEnrichment,
  FlightQuoteSnapshot,
} from './ports/travel-quote.types';
import {
  ITravelQuotePort,
  TRAVEL_QUOTE_PORT,
  type TravelQuoteEnrichOptions,
} from './ports/travel-quote.port';

type ActivityRecord = TravelQuoteActivity;

@Injectable()
export class TravelQuoteEnrichmentService {
  constructor(
    @Inject(TRAVEL_QUOTE_PORT)
    private readonly quotePort: ITravelQuotePort,
  ) {}

  run(
    activity: ActivityRecord,
    dto: GenerateTravelGuideDto,
    mapCtx: TravelGuideMapContext,
    accommodationNights: number,
    options?: TravelQuoteEnrichOptions,
  ): Promise<TravelQuoteEnrichment | null> {
    return this.quotePort.enrich(
      activity,
      dto,
      mapCtx,
      accommodationNights,
      options,
    );
  }

  async fetchHotelQuoteForTier(
    activity: ActivityRecord,
    dto: GenerateTravelGuideDto,
    mapCtx: TravelGuideMapContext,
    accommodationNights: number,
    tier: TravelGuideBudgetTier,
  ): Promise<HotelQuoteSnapshot | null> {
    const query = buildTravelQuoteQuery(
      activity,
      dto,
      mapCtx,
      accommodationNights,
    );
    if (!query) return null;
    return this.quotePort.fetchHotelQuoteForTier(query, tier);
  }

  async fetchFlightQuoteForTier(
    activity: ActivityRecord,
    dto: GenerateTravelGuideDto,
    mapCtx: TravelGuideMapContext,
    accommodationNights: number,
    tier: TravelGuideBudgetTier,
  ): Promise<FlightQuoteSnapshot | null> {
    const query = buildTravelQuoteQuery(
      activity,
      dto,
      mapCtx,
      accommodationNights,
    );
    if (!query) return null;
    return this.quotePort.fetchFlightQuoteForTier(query, tier);
  }
}
