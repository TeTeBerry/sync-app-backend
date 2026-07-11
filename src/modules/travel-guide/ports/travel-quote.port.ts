import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import type { TravelQuoteActivity } from '../domain/travel-guide-quote.util';
import type { TravelGuideMapContext } from '../map/travel-guide-map.types';
import type {
  FlightQuoteSnapshot,
  HotelQuoteSnapshot,
  TravelQuoteEnrichment,
  TravelQuoteQuery,
} from './travel-quote.types';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { RollingGoMcpCallOptions } from '../infra/rollinggo/rollinggo-mcp.types';
import type { TravelGuideProgressReporter } from '../domain/travel-guide-generation-progress.util';

export type TravelQuoteEnrichOptions = {
  onProgress?: TravelGuideProgressReporter;
  /**
   * Skip RollingGo hotel MCP when RouteStack owns EN stays
   * (Raven / sync-web with ROUTESTACK_ENABLED).
   */
  skipHotels?: boolean;
};

export interface ITravelQuotePort {
  enrich(
    activity: TravelQuoteActivity,
    dto: GenerateTravelGuideDto,
    mapCtx: TravelGuideMapContext,
    accommodationNights: number,
    options?: TravelQuoteEnrichOptions,
  ): Promise<TravelQuoteEnrichment | null>;

  fetchHotelQuoteForTier(
    query: TravelQuoteQuery,
    tier: TravelGuideBudgetTier,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<HotelQuoteSnapshot | null>;

  fetchFlightQuoteForTier(
    query: TravelQuoteQuery,
    tier: TravelGuideBudgetTier,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<FlightQuoteSnapshot | null>;
}

export const TRAVEL_QUOTE_PORT = Symbol('TRAVEL_QUOTE_PORT');
