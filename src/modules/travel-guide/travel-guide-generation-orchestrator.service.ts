import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  assertUserUgcTexts,
  collectTravelGuideUgcTexts,
} from '../../common/media/user-ugc-text.util';
import { ActivityService } from '../activity/activity.service';
import { WechatContentSecurityService } from '../auth/wechat-content-security.service';
import { AmapMapService } from './map/amap.service';
import type { GenerateTravelGuideDto } from './dto/generate-travel-guide.dto';
import {
  parseActivityDayCount,
  resolveTravelGuideBudgetTier,
} from './domain/parse-activity-days.util';
import { resolveTravelGuideLocale } from './domain/travel-guide-locale';
import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import { applyTravelGuideAccommodationPreference } from './domain/travel-guide-accommodation-preference.util';
import { TravelGuideGuardService } from './travel-guide-guard.service';
import { TravelGuideSavedPlanService } from './travel-guide-saved-plan.service';
import { resolveTravelGuideOwnerUserId } from './domain/travel-guide-owner.util';
import {
  buildTravelGuideGenerationCacheKey,
  normalizeTravelGuideGenerationParams,
  reconcileDepartureCityForCache,
} from './domain/travel-guide-generation-cache.util';
import { buildPlanHotelByTierFromMapRankings } from './domain/travel-guide-map-hotel-tier.util';
import { buildPlanHotelByTierFromHotPath } from './domain/travel-guide-abroad-accommodation.util';
import { buildMinimalMapContextForQuote } from './domain/travel-guide-quote-map-context.util';
import {
  isTravelGuideAbroad,
  travelGuideRegionKind,
} from './domain/travel-guide-international.util';
import { shouldFetchTravelQuote } from './domain/travel-guide-quote.util';
import { resolveTravelGuideQuoteDates } from './domain/travel-guide-quote-dates.util';
import {
  isPlanQuoteFresh,
  resolveQuoteCacheTtlMs,
} from './domain/travel-guide-quote-freshness.util';
import { TravelQuoteEnrichmentService } from './travel-quote-enrichment.service';
import {
  reportTravelGuideProgress,
  type TravelGuideProgressReporter,
} from './domain/travel-guide-generation-progress.util';
import { LocationSearchService } from './search/location-search.service';
import { FlightSearchService } from './search/flight-search.service';
import { HotelSearchService } from './search/hotel-search.service';
import { TicketSearchService } from './search/ticket-search.service';
import { FlightRecommendationService } from './recommendation/flight-recommendation.service';
import { HotelRecommendationService } from './recommendation/hotel-recommendation.service';
import { TravelGuideLlmService } from './ai/travel-guide-llm.service';
import { TravelGuideCacheService } from './cache/travel-guide-cache.service';
import { TravelGuideBudgetService } from './budget/travel-guide-budget.service';
import {
  createInitialPlanGenerationContext,
  resolveGenerationStatus,
} from './types/plan-generation-context';
import { destinationCityFromActivityLocation } from './map/travel-guide-intercity.util';
import { selectOptionsFromRecommendations } from './domain/select-recommended-options.util';
import { assembleTravelGuidePlanFromContext } from './domain/assemble-travel-guide-plan.util';
import { attachQuoteTierMetadataToPlan } from './domain/attach-quote-tier-metadata.util';
import { dominantCurrency } from './budget/budget-constraints.types';
import { mapCandidatesToLlmFallback } from './map/travel-guide-map-plan.builder';

export type TravelGuideGenerateOptions = {
  onProgress?: TravelGuideProgressReporter;
};

/**
 * Coordinates travel-guide generation only.
 * Provider parsing, scoring formulas, LLM prompts, and Mongo queries live in
 * dedicated search / recommendation / AI / persistence / cache services.
 */
@Injectable()
export class TravelGuideGenerationOrchestrator {
  private readonly logger = new Logger(TravelGuideGenerationOrchestrator.name);

  constructor(
    private readonly activityService: ActivityService,
    private readonly amap: AmapMapService,
    private readonly config: ConfigService,
    private readonly locationSearch: LocationSearchService,
    private readonly flightSearch: FlightSearchService,
    private readonly hotelSearch: HotelSearchService,
    private readonly ticketSearch: TicketSearchService,
    private readonly flightRecommendation: FlightRecommendationService,
    private readonly hotelRecommendation: HotelRecommendationService,
    private readonly llmService: TravelGuideLlmService,
    private readonly planCache: TravelGuideCacheService,
    private readonly budgetService: TravelGuideBudgetService,
    private readonly travelGuideGuard: TravelGuideGuardService,
    private readonly savedPlanService: TravelGuideSavedPlanService,
    private readonly wechatContentSecurity: WechatContentSecurityService,
    private readonly quoteEnrichment: TravelQuoteEnrichmentService,
  ) {}

  async generate(
    activityLegacyId: number,
    dto: GenerateTravelGuideDto,
    actor: RequestActor,
    options?: TravelGuideGenerateOptions,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
    const onProgress = options?.onProgress;
    await reportTravelGuideProgress(onProgress, 'validating');

    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) {
      throw new NotFoundException(`Activity ${activityLegacyId} not found`);
    }

    if (!this.amap.enabled && !isTravelGuideAbroad(activity)) {
      throw new ServiceUnavailableException(
        'AI 出行攻略依赖高德地图，请配置 AMAP_KEY 后重试',
      );
    }

    await assertUserUgcTexts(
      this.wechatContentSecurity,
      collectTravelGuideUgcTexts(dto),
    );

    const accommodationNights =
      dto.accommodationNights ?? parseActivityDayCount(activity.date);

    const departure = dto.departure.trim();
    const departureCity = reconcileDepartureCityForCache(
      departure,
      dto.departureCity?.trim(),
    );

    const { departureCity: _dtoDepartureCity, ...dtoRest } = dto;
    const generationDto: GenerateTravelGuideDto = {
      ...dtoRest,
      departure,
      ...(departureCity ? { departureCity } : {}),
      accommodationNights,
      budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
      locale: resolveTravelGuideLocale(dto.locale),
    };

    const cacheParams = normalizeTravelGuideGenerationParams(
      activityLegacyId,
      generationDto,
      accommodationNights,
    );
    const cacheKey = buildTravelGuideGenerationCacheKey(cacheParams);
    const skipGenerationCache = generationDto.forceRegenerate === true;

    if (!skipGenerationCache) {
      const cachedPlan = await this.planCache.findGeneratedPlan(cacheKey);
      if (cachedPlan) {
        this.logger.log(
          `travel guide cache hit activity=${activityLegacyId} key=${cacheKey.slice(0, 8)}`,
        );
        const { plan: enriched, quoteRefreshed } =
          await this.enrichCachedPlanWithQuotes(
            cachedPlan,
            activity,
            generationDto,
            accommodationNights,
            onProgress,
          );
        if (quoteRefreshed) {
          await this.planCache.saveGeneratedPlan(
            cacheKey,
            activityLegacyId,
            cacheParams,
            enriched,
          );
        }
        await reportTravelGuideProgress(onProgress, 'completed');
        return this.finishWithPlan(
          dto,
          accommodationNights,
          actor,
          activityLegacyId,
          enriched,
        );
      }

      const fuzzyPlan =
        await this.planCache.findSimilarGeneratedPlan(cacheParams);
      if (fuzzyPlan) {
        this.logger.log(
          `travel guide fuzzy cache hit activity=${activityLegacyId}`,
        );
        const { plan: enriched } = await this.enrichCachedPlanWithQuotes(
          fuzzyPlan,
          activity,
          generationDto,
          accommodationNights,
          onProgress,
        );
        await reportTravelGuideProgress(onProgress, 'completed');
        return this.finishWithPlan(
          dto,
          accommodationNights,
          actor,
          activityLegacyId,
          enriched,
        );
      }
    } else {
      this.logger.log(
        `travel guide force regenerate activity=${activityLegacyId} departure="${generationDto.departure.trim()}"`,
      );
    }

    await this.travelGuideGuard.assertCanGenerate(
      actor.resolvedUserId,
      activityLegacyId,
    );

    const lockAcquired = await this.travelGuideGuard.acquireGenerationLock(
      actor.resolvedUserId,
      activityLegacyId,
      generationDto,
      accommodationNights,
    );
    if (!lockAcquired) {
      const racingPlan =
        (await this.planCache.findGeneratedPlan(cacheKey)) ??
        (await this.planCache.findSimilarGeneratedPlan(cacheParams));
      if (racingPlan) {
        const { plan: enriched } = await this.enrichCachedPlanWithQuotes(
          racingPlan,
          activity,
          generationDto,
          accommodationNights,
          onProgress,
        );
        await reportTravelGuideProgress(onProgress, 'completed');
        return this.finishWithPlan(
          dto,
          accommodationNights,
          actor,
          activityLegacyId,
          enriched,
        );
      }
      throw new ServiceUnavailableException(
        '相同参数的攻略正在生成中，请稍后再试',
      );
    }

    const ctx = createInitialPlanGenerationContext({
      activity,
      dto: generationDto,
      actor,
      accommodationNights,
      cacheKey,
    });

    try {
      await reportTravelGuideProgress(onProgress, 'map_poi');
      const location = await this.locationSearch.resolveAndCollect(
        activity,
        generationDto,
        accommodationNights,
      );
      if (!location.mapCtx || !location.ranked) {
        throw new ServiceUnavailableException(
          '无法获取场馆周边推荐（酒店/散场/停车），请确认活动地址或明日再试；若使用高德 Key，请检查配额是否用尽',
        );
      }
      ctx.locations = {
        mapCtx: location.mapCtx,
        ranked: location.ranked,
      };
      ctx.sectionStatus.pois = 'ready';

      const quoteEligible = shouldFetchTravelQuote(
        activity,
        generationDto,
        location.mapCtx,
      );
      const planLocale = resolveTravelGuideLocale(generationDto.locale);
      const useRouteStackHotels =
        planLocale === 'en' && this.hotelSearch.isRouteStackEnabled();

      let quoteSnapshot = null;
      if (quoteEligible) {
        try {
          quoteSnapshot = await this.quoteEnrichment.run(
            activity,
            generationDto,
            location.mapCtx,
            accommodationNights,
            {
              onProgress,
              // EN + RouteStack: do not call RollingGo searchHotels.
              skipHotels: useRouteStackHotels,
            },
          );
          ctx.quoteEnrichment = quoteSnapshot;
        } catch (error) {
          ctx.sectionStatus.flights = 'failed';
          if (!useRouteStackHotels) {
            ctx.sectionStatus.hotels = 'failed';
          }
          ctx.errors.push({
            section: 'flights',
            code: 'QUOTE_PROVIDER_FAILED',
            message: error instanceof Error ? error.message : String(error),
          });
          this.logger.warn(
            `travel guide quote enrichment failed activity=${activityLegacyId}: ${
              error instanceof Error ? error.message : error
            }`,
          );
        }
      } else {
        ctx.sectionStatus.flights = 'skipped';
      }

      const flights = this.flightSearch.fromEnrichment(quoteSnapshot);
      ctx.searchResults.flights = flights;
      ctx.sectionStatus.flights =
        ctx.sectionStatus.flights === 'failed'
          ? 'failed'
          : flights.length
            ? 'ready'
            : quoteEligible
              ? 'unavailable'
              : 'skipped';

      const mapHotels = this.hotelSearch.fromMapRanked(
        location.ranked.hotels,
        accommodationNights,
      );
      const quoteHotels = useRouteStackHotels
        ? []
        : this.hotelSearch.fromEnrichment(quoteSnapshot, accommodationNights);
      const selectedBudgetTier = resolveTravelGuideBudgetTier(
        generationDto.budgetTier,
      );
      const regionKind = travelGuideRegionKind(activity);

      // EN Raven / sync-web: RouteStack SearchDestinations → SearchHotels only.
      // Do not fall back to Amap map hotels (often Chinese / CNY) when RouteStack is on.
      let hotels = useRouteStackHotels ? [] : [...quoteHotels, ...mapHotels];
      if (useRouteStackHotels && accommodationNights > 0) {
        const destinationCity =
          destinationCityFromActivityLocation(
            activity.location,
            activity.area,
          ) ||
          location.mapCtx.venue.title ||
          '';
        const { outboundDate, returnDate } = resolveTravelGuideQuoteDates(
          activity.date,
          accommodationNights,
        );
        try {
          const routeStackHotels = await this.hotelSearch.search({
            destinationCity,
            checkInDate: outboundDate,
            checkOutDate: returnDate,
            accommodationNights,
            headcount: generationDto.headcount,
            budgetTier: selectedBudgetTier,
            regionKind,
            locale: 'en',
            venue: {
              lat: location.mapCtx.venue.lat,
              lng: location.mapCtx.venue.lng,
              title: location.mapCtx.venue.title,
            },
            activityLegacyId: activity.legacyId,
            activityName: activity.name,
            activityCode: activity.code,
            activityArea: activity.area,
            activityLocation: activity.location,
            forceRefresh: Boolean(generationDto.forceRegenerate),
          });
          hotels = routeStackHotels;
          this.logger.log(
            `EN hotel provider=routestack activity=${activityLegacyId} count=${hotels.length}`,
          );
          if (!hotels.length) {
            ctx.errors.push({
              section: 'hotels',
              code: 'ROUTESTACK_HOTEL_EMPTY',
              message: 'RouteStack hotel search returned no listings',
            });
          }
        } catch (error) {
          this.logger.warn(
            `RouteStack EN hotel search failed activity=${activityLegacyId}: ${
              error instanceof Error ? error.message : error
            }`,
          );
          hotels = [];
          ctx.sectionStatus.hotels = 'failed';
          ctx.errors.push({
            section: 'hotels',
            code: 'ROUTESTACK_HOTEL_SEARCH_FAILED',
            message: error instanceof Error ? error.message : String(error),
          });
        }
      }

      ctx.searchResults.hotels = hotels;
      ctx.sectionStatus.hotels =
        accommodationNights <= 0
          ? 'skipped'
          : hotels.length
            ? 'ready'
            : ctx.sectionStatus.hotels === 'failed'
              ? 'failed'
              : 'unavailable';
      const interCity = quoteEligible || Boolean(location.mapCtx.interCity);
      // EN plans score in USD (RouteStack stays + EN display currency).
      const scoringCurrency =
        planLocale === 'en'
          ? 'USD'
          : (dominantCurrency([
              ...ctx.searchResults.flights.map((f) => f.price.currency),
              ...ctx.searchResults.hotels.map((h) => h.price?.currency),
            ]) ?? 'CNY');

      // A) Budget policy / constraints BEFORE recommendation scoring.
      ctx.budgetConstraints = this.budgetService.resolveBudgetConstraints({
        dto: generationDto,
        accommodationNights,
        regionKind,
        interCity,
        currency: scoringCurrency,
      });

      ctx.recommendations.flights = this.flightRecommendation.recommend(
        ctx.searchResults.flights,
        ctx.budgetConstraints,
      );
      ctx.recommendations.hotels = this.hotelRecommendation.recommend(
        ctx.searchResults.hotels,
        ctx.budgetConstraints,
      );

      // Authoritative selection — do not re-select in builder/LLM/enrich.
      // Precedence: bestOverall → first normalized → (arrays already include quote-normalized).
      ctx.selectedOptions = selectOptionsFromRecommendations({
        flights: ctx.searchResults.flights,
        hotels: ctx.searchResults.hotels,
        tickets: [],
        flightRecommendations: ctx.recommendations.flights,
        hotelRecommendations: ctx.recommendations.hotels,
      });

      try {
        ctx.searchResults.tickets = await this.ticketSearch.search({
          activityLegacyId: activity.legacyId,
          activityName: activity.name,
          activityCode: activity.code,
          activityLocation: activity.location,
          region: activity.region,
          externalUrl: activity.externalUrl,
          locale: planLocale,
        });
        ctx.sectionStatus.tickets = ctx.searchResults.tickets.length
          ? 'ready'
          : 'unavailable';
      } catch (error) {
        ctx.sectionStatus.tickets = 'failed';
        ctx.errors.push({
          section: 'tickets',
          code: 'TICKET_SEARCH_FAILED',
          message: error instanceof Error ? error.message : String(error),
        });
      }

      // Attach ticket after search without re-picking flight/hotel.
      const ticket =
        ctx.searchResults.tickets.find((t) => t.availability === 'available') ??
        ctx.searchResults.tickets[0];
      if (ticket) {
        ctx.selectedOptions = { ...ctx.selectedOptions, ticket };
      }

      // B) Final budget summary AFTER selectedOptions (+ tickets).
      ctx.budget = this.budgetService.buildFromSelected({
        budgetTier: selectedBudgetTier,
        headcount: generationDto.headcount,
        accommodationNights,
        interCity,
        regionKind,
        selfDrive: Boolean(generationDto.selfDrive),
        selected: ctx.selectedOptions,
        flights: ctx.searchResults.flights,
        hotels: ctx.searchResults.hotels,
        tickets: ctx.searchResults.tickets,
        locale: generationDto.locale,
      });
      ctx.sectionStatus.budget = ctx.budget.items.length
        ? 'ready'
        : 'unavailable';

      await reportTravelGuideProgress(onProgress, 'ai_writing');
      try {
        ctx.generatedContent = await this.llmService.generatePlanContent({
          activity,
          dto: generationDto,
          accommodationNights,
          mapCtx: location.mapCtx,
          ranked: location.ranked,
          recommendations: ctx.recommendations,
          selectedOptions: ctx.selectedOptions,
          budget: ctx.budget,
          budgetConstraints: ctx.budgetConstraints,
          tickets: ctx.searchResults.tickets,
        });
        ctx.sectionStatus.itinerary = 'ready';
      } catch (error) {
        this.logger.warn(
          `travel guide LLM payload failed activity=${activityLegacyId}: ${
            error instanceof Error ? error.message : error
          }`,
        );
        // Prefer map/locale baseline over a bare error tip when polish throws.
        try {
          ctx.generatedContent = mapCandidatesToLlmFallback(
            location.mapCtx,
            location.ranked,
            {
              departure: generationDto.departure.trim(),
              departureCity: generationDto.departureCity?.trim(),
              selfDrive: Boolean(generationDto.selfDrive),
              accommodationNights,
              headcount: generationDto.headcount,
              activity,
              locale: generationDto.locale,
            },
          );
          if (ctx.budget.items.length) {
            ctx.generatedContent = {
              ...ctx.generatedContent,
              budgetItems: ctx.budget.items,
            };
          }
          // Map baseline is usable — keep cacheable. Record polish failure only.
          ctx.sectionStatus.itinerary = 'ready';
          ctx.errors.push({
            section: 'itinerary',
            code: 'LLM_POLISH_FAILED_MAP_FALLBACK',
            message: error instanceof Error ? error.message : String(error),
          });
        } catch (fallbackError) {
          const locale = resolveTravelGuideLocale(generationDto.locale);
          ctx.sectionStatus.itinerary = 'failed';
          ctx.errors.push({
            section: 'itinerary',
            code: 'LLM_VALIDATION_FAILED',
            message: error instanceof Error ? error.message : String(error),
          });
          ctx.generatedContent = {
            transportLines: ctx.selectedOptions.flight
              ? [
                  `${ctx.selectedOptions.flight.originAirportCode}→${ctx.selectedOptions.flight.destinationAirportCode}`,
                ]
              : [],
            hotels: ctx.selectedOptions.hotel
              ? [
                  {
                    name: ctx.selectedOptions.hotel.name,
                    note:
                      locale === 'en'
                        ? 'Recommended stay (plan copy temporarily unavailable)'
                        : '推荐住宿（AI 文案暂不可用）',
                  },
                ]
              : [],
            nightlifeSpots: location.ranked.nightlife.slice(0, 4).map((p) => ({
              name: p.name,
              note: p.address ?? '',
            })),
            tipItems: [
              locale === 'en'
                ? 'Plan copy failed — kept recommended flight/hotel and budget summary.'
                : '行程文案生成失败，已保留推荐航班/酒店与预算汇总。',
            ],
            budgetItems: ctx.budget.items,
          };
          this.logger.warn(
            `travel guide map fallback also failed activity=${activityLegacyId}: ${
              fallbackError instanceof Error
                ? fallbackError.message
                : fallbackError
            }`,
          );
        }
      }

      await reportTravelGuideProgress(onProgress, 'assembling');
      const mapHotelByTier =
        accommodationNights > 0 && regionKind === 'domestic'
          ? buildPlanHotelByTierFromMapRankings(
              { [selectedBudgetTier]: location.ranked.hotels },
              {
                accommodationNights,
                headcount: generationDto.headcount,
                activity,
                selectedBudgetTier,
              },
            )
          : accommodationNights > 0
            ? buildPlanHotelByTierFromHotPath(activity, {
                accommodationNights,
                headcount: generationDto.headcount,
                budgetTier: selectedBudgetTier,
              })
            : undefined;

      let plan = assembleTravelGuidePlanFromContext(ctx);
      if (mapHotelByTier) {
        plan = {
          ...plan,
          hotelByTier: {
            ...(plan.hotelByTier ?? {}),
            ...mapHotelByTier,
          },
        };
      }

      ctx.sectionStatus.budget = plan.budget?.items?.length
        ? 'ready'
        : ctx.sectionStatus.budget;
      ctx.generationStatus = resolveGenerationStatus(ctx.sectionStatus);
      ctx.plan = plan;

      this.logger.log(
        `travel guide assembled activity=${activityLegacyId} status=${ctx.generationStatus} ` +
          `selectedFlight=${ctx.selectedOptions.flight?.id ?? 'none'} ` +
          `selectedHotel=${ctx.selectedOptions.hotel?.id ?? 'none'} ` +
          `budget=${ctx.budget?.total.min ?? 0}-${ctx.budget?.total.max ?? 0} ` +
          `flights=${ctx.sectionStatus.flights} hotels=${ctx.sectionStatus.hotels} ` +
          `tickets=${ctx.sectionStatus.tickets} destination=${destinationCityFromActivityLocation(activity.location) || ''}`,
      );

      await reportTravelGuideProgress(onProgress, 'finishing');
      // Only skip cache for tip-shell degradation (itinerary=failed).
      // Map-baseline fallback is marked ready and remains cacheable.
      if (ctx.sectionStatus.itinerary !== 'failed') {
        await this.planCache.saveGeneratedPlan(
          cacheKey,
          activityLegacyId,
          cacheParams,
          plan,
        );
      } else {
        this.logger.warn(
          `travel guide skip cache activity=${activityLegacyId} key=${cacheKey.slice(0, 8)} itinerary=failed`,
        );
      }

      await reportTravelGuideProgress(onProgress, 'completed');
      return this.finishWithPlan(
        dto,
        accommodationNights,
        actor,
        activityLegacyId,
        plan,
      );
    } finally {
      await this.travelGuideGuard.releaseGenerationLock(
        actor.resolvedUserId,
        activityLegacyId,
        generationDto,
        accommodationNights,
      );
    }
  }

  /** 缓存命中时按需补跑 RollingGo（受 quote TTL 与 forceRegenerate 约束）。 */
  private async enrichCachedPlanWithQuotes(
    plan: TravelGuidePlan,
    activity: Awaited<ReturnType<ActivityService['findByLegacyId']>>,
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    onProgress?: TravelGuideProgressReporter,
  ): Promise<{ plan: TravelGuidePlan; quoteRefreshed: boolean }> {
    if (!activity) {
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const mapCtx = buildMinimalMapContextForQuote(plan, activity, dto);
    const quoteEligible = shouldFetchTravelQuote(activity, dto, mapCtx);
    if (!quoteEligible) {
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const quoteTtlMs = resolveQuoteCacheTtlMs(
      this.config.get<number>('rollinggo.quoteCacheTtlSec'),
    );
    if (dto.forceRegenerate !== true && isPlanQuoteFresh(plan, quoteTtlMs)) {
      this.logger.log(
        `travel guide quote cache fresh activity=${activity.legacyId} fetchedAt=${plan.quoteFetchedAt}`,
      );
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const quoteSnapshot = await this.quoteEnrichment.run(
      activity,
      dto,
      mapCtx,
      accommodationNights,
      {
        onProgress,
        skipHotels:
          resolveTravelGuideLocale(dto.locale) === 'en' &&
          this.hotelSearch.isRouteStackEnabled(),
      },
    );

    if (
      !quoteSnapshot?.flight &&
      !quoteSnapshot?.hotel &&
      !quoteSnapshot?.flightByTier
    ) {
      return {
        plan: applyTravelGuideAccommodationPreference(
          plan,
          accommodationNights,
        ),
        quoteRefreshed: false,
      };
    }

    const enriched = attachQuoteTierMetadataToPlan(plan, quoteSnapshot, {
      headcount: dto.headcount,
      accommodationNights,
      budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
      locale: resolveTravelGuideLocale(dto.locale),
    });

    return {
      plan: applyTravelGuideAccommodationPreference(
        enriched,
        accommodationNights,
      ),
      quoteRefreshed: Boolean(
        quoteSnapshot?.flight ||
        quoteSnapshot?.hotel ||
        quoteSnapshot?.flightByTier ||
        quoteSnapshot?.hotelByTier,
      ),
    };
  }

  private async finishWithPlan(
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    actor: RequestActor,
    activityLegacyId: number,
    plan: TravelGuidePlan,
  ): Promise<{ plan: TravelGuidePlan; guideId?: string }> {
    const ownerUserId = resolveTravelGuideOwnerUserId(actor, {
      guideId: dto.guideId,
    });
    const guideId = await this.persistSavedPlanIfRequested(
      dto,
      accommodationNights,
      ownerUserId,
      activityLegacyId,
      plan,
      actor,
    );
    return guideId ? { plan, guideId } : { plan };
  }

  private async persistSavedPlanIfRequested(
    dto: GenerateTravelGuideDto,
    accommodationNights: number,
    ownerUserId: string,
    activityLegacyId: number,
    plan: TravelGuidePlan,
    actor: RequestActor,
  ): Promise<string | undefined> {
    const guideId = dto.guideId?.trim();
    if (!guideId) return undefined;

    await this.savedPlanService.upsert(
      guideId,
      ownerUserId,
      activityLegacyId,
      dto,
      accommodationNights,
      plan,
      actor,
    );
    return guideId;
  }
}
