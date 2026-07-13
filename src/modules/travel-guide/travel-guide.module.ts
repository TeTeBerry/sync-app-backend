import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import {
  TravelGuideGenerationCache,
  TravelGuideGenerationCacheSchema,
} from '../../database/schemas/travel-guide-generation-cache.schema';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobSchema,
} from '../../database/schemas/travel-guide-generation-job.schema';
import {
  TravelGuideSavedPlan,
  TravelGuideSavedPlanSchema,
} from '../../database/schemas/travel-guide-saved-plan.schema';
import {
  TravelGuideVenueCache,
  TravelGuideVenueCacheSchema,
} from '../../database/schemas/travel-guide-venue-cache.schema';
import { ActivityModule } from '../activity/activity.module';
import { UserGoalModule } from '../goal/goal.module';
import { TripPlanModule } from '../trip-plan/trip-plan.module';
import { WechatMiniModule } from '../auth/wechat-mini.module';
import { UserModule } from '../user/user.module';
import { AmapMapService } from './map/amap.service';
import { TravelGuideGeoCacheService } from './map/travel-guide-geo-cache.service';
import { TravelGuidePoiCollector } from './map/travel-guide-poi.collector';
import { TravelGuidePoiRanker } from './map/travel-guide-poi.ranker';
import { TravelGuidePoiPipeline } from './map/travel-guide-poi.pipeline';
import { TravelGuideVenueCacheSeedService } from './map/travel-guide-venue-cache.seed';
import { TravelGuideController } from './travel-guide.controller';
import { TravelGuideGlobalController } from './travel-guide-global.controller';
import { TravelGuideMapController } from './travel-guide-map.controller';
import { TravelGuideGenerationCacheService } from './travel-guide-generation-cache.service';
import { TravelGuideGenerationJobService } from './travel-guide-generation-job.service';
import { TravelGuideGenerationService } from './travel-guide-generation.service';
import { TravelGuideGenerationOrchestrator } from './travel-guide-generation-orchestrator.service';
import { TravelGuideLlmPolishService } from './travel-guide-llm-polish.service';
import { TravelGuideBudgetTierService } from './travel-guide-budget-tier.service';
import { TravelGuideFormService } from './travel-guide-form.service';
import { TravelGuideGuardService } from './travel-guide-guard.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import { RollingGoMcpClient } from './infra/rollinggo/rollinggo-mcp.client';
import { RollingGoTravelQuoteAdapter } from './infra/rollinggo/rollinggo-travel-quote.adapter';
import { TRAVEL_QUOTE_PORT } from './ports/travel-quote.port';
import { TravelGuideQuoteRefreshService } from './travel-guide-quote-refresh.service';
import { TravelQuoteEnrichmentService } from './travel-quote-enrichment.service';
import { LocationSearchService } from './search/location-search.service';
import { FlightSearchService } from './search/flight-search.service';
import { HotelSearchService } from './search/hotel-search.service';
import { TicketSearchService } from './search/ticket-search.service';
import { FlightRecommendationService } from './recommendation/flight-recommendation.service';
import { HotelRecommendationService } from './recommendation/hotel-recommendation.service';
import { TravelGuideLlmService } from './ai/travel-guide-llm.service';
import { TravelGuideBudgetService } from './budget/travel-guide-budget.service';
import { TravelGuideCacheService } from './cache/travel-guide-cache.service';
import { TravelGuidePlanRepository } from './persistence/travel-guide-plan.repository';
import { FLIGHT_PROVIDER } from './providers/flight-provider.interface';
import { HOTEL_PROVIDER } from './providers/hotel-provider.interface';
import { TICKET_PROVIDER } from './providers/ticket-provider.interface';
import { RollingGoFlightProvider } from './providers/rollinggo/rolling-go-flight.provider';
import { RollingGoHotelProvider } from './providers/rollinggo/rolling-go-hotel.provider';
import { RouteStackHttpClient } from './infra/routestack/routestack-http.client';
import { RouteStackHotelProvider } from './providers/routestack/routestack-hotel.provider';
import { CatalogTicketProvider } from './providers/catalog-ticket.provider';
import { OpenFlightsAirportCatalogService } from './raven/openflights-airport-catalog.service';
import { RavenPlaceSuggestionsController } from './raven/raven-place-suggestions.controller';
import { RavenPlanController } from './raven/raven-plan.controller';
import { RavenFestivalWeatherController } from './raven/raven-festival-weather.controller';
import { RavenFestivalWeatherService } from './raven/raven-festival-weather.service';

@Module({
  imports: [
    ActivityModule,
    UserGoalModule,
    TripPlanModule,
    WechatMiniModule,
    UserModule,
    InfraLlmModule,
    MongooseModule.forFeature([
      { name: TravelGuideVenueCache.name, schema: TravelGuideVenueCacheSchema },
      {
        name: TravelGuideGenerationCache.name,
        schema: TravelGuideGenerationCacheSchema,
      },
      {
        name: TravelGuideGenerationJob.name,
        schema: TravelGuideGenerationJobSchema,
      },
      {
        name: TravelGuideSavedPlan.name,
        schema: TravelGuideSavedPlanSchema,
      },
    ]),
  ],
  controllers: [
    TravelGuideController,
    TravelGuideGlobalController,
    TravelGuideMapController,
    RavenPlaceSuggestionsController,
    RavenPlanController,
    RavenFestivalWeatherController,
  ],
  providers: [
    AmapMapService,
    TravelGuideGeoCacheService,
    TravelGuideVenueCacheSeedService,
    TravelGuidePoiCollector,
    TravelGuidePoiRanker,
    TravelGuidePoiPipeline,
    TravelGuideLlmPolishService,
    TravelGuideLlmService,
    TravelGuideGenerationOrchestrator,
    TravelGuideGenerationCacheService,
    TravelGuideCacheService,
    TravelGuideGenerationJobService,
    TravelGuideGenerationService,
    TravelGuideBudgetTierService,
    TravelGuideBudgetService,
    TravelGuideFormService,
    TravelGuideGuardService,
    TravelGuidePlanRepository,
    TravelGuideSavedPlanService,
    RollingGoMcpClient,
    RollingGoTravelQuoteAdapter,
    {
      provide: TRAVEL_QUOTE_PORT,
      useExisting: RollingGoTravelQuoteAdapter,
    },
    RollingGoFlightProvider,
    RollingGoHotelProvider,
    RouteStackHttpClient,
    RouteStackHotelProvider,
    CatalogTicketProvider,
    {
      provide: FLIGHT_PROVIDER,
      useExisting: RollingGoFlightProvider,
    },
    {
      provide: HOTEL_PROVIDER,
      useExisting: RollingGoHotelProvider,
    },
    {
      provide: TICKET_PROVIDER,
      useExisting: CatalogTicketProvider,
    },
    LocationSearchService,
    FlightSearchService,
    HotelSearchService,
    TicketSearchService,
    FlightRecommendationService,
    HotelRecommendationService,
    TravelQuoteEnrichmentService,
    TravelGuideQuoteRefreshService,
    OpenFlightsAirportCatalogService,
    RavenFestivalWeatherService,
  ],
  exports: [
    TravelGuideGenerationService,
    TravelGuideGenerationJobService,
    TravelGuideSavedPlanService,
  ],
})
export class TravelGuideModule {}
