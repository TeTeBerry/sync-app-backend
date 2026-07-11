import { Injectable, Logger } from '@nestjs/common';
import type { GenerateTravelGuideDto } from '../../dto/generate-travel-guide.dto';
import {
  buildTravelQuoteQuery,
  type TravelQuoteActivity,
} from '../../domain/travel-guide-quote.util';
import {
  mapSyncBudgetTierToRollingGoHotelGrade,
  rollingGoHotelGradeLabel,
  rollingGoHotelGradeStarRatings,
} from '../../domain/travel-guide-rollinggo-hotel-tier.util';
import {
  rollingGoCabinGradeLabel,
  rollingGoCabinGradesForBudgetTier,
  rollingGoCabinLabelForBudgetTier,
  SYNC_BUDGET_TIER_ORDER,
  type RollingGoCabinGrade,
} from '../../domain/travel-guide-rollinggo-flight-tier.util';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import {
  resolveDepartureCityLabel,
  resolveKnownDepartureCityCode,
  resolveKnownDestinationCityCode,
} from '../../domain/travel-guide-departure-airport.util';
import { buildRollingGoQuoteGeoContext } from '../../domain/travel-guide-rollinggo-geo.util';
import { resolveActivityAlternateAirportCodes } from '@src/data/travel-guide/travel-guide-activity-airports.data';
import { addDays } from '../../domain/travel-guide-quote-dates.util';
import type { TravelGuideMapContext } from '../../map/travel-guide-map.types';
import type { ITravelQuotePort } from '../../ports/travel-quote.port';
import type {
  FlightQuoteSnapshot,
  HotelQuoteSnapshot,
  TravelQuoteEnrichment,
  TravelQuoteQuery,
} from '../../ports/travel-quote.types';
import type { RollingGoMcpCallOptions } from './rollinggo-mcp.types';
import type { RollingGoHotelRecord } from './rollinggo-mcp.types';
import {
  RollingGoMcpClient,
  pickCityCode,
  summarizeFlightOffers,
} from './rollinggo-mcp.client';
import { resolveFlightOfferCurrency } from '../../domain/travel-guide-flight-budget.util';
import { buildRollingGoHotelOriginQuery } from '../../domain/travel-guide-rollinggo-hotel-query.util';
import { buildDiversifiedRollingGoHotelQuotesByTier } from '../../domain/travel-guide-rollinggo-hotel-quotes.util';
import { reportTravelGuideProgress } from '../../domain/travel-guide-generation-progress.util';
import type { TravelQuoteEnrichOptions } from '../../ports/travel-quote.port';

type ActivityRecord = TravelQuoteActivity;

const FLIGHT_SEARCH_MAX_ATTEMPTS = 3;
const FLIGHT_SEARCH_RETRY_DELAY_MS = 500;
const FLIGHT_TIER_GAP_MS = 200;

type ResolvedFlightWindow = {
  tripType: 'ROUND_TRIP' | 'ONE_WAY';
  returnDate?: string;
};

type FlightAirportCandidate = {
  toCity: string;
  /** How this destination code was chosen (for logs). */
  source: string;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientRollingGoFlightFailure(message?: string): boolean {
  if (!message?.trim()) return false;
  return /失败|稍后重试|繁忙|timeout|aborted|too many|rate limit/i.test(
    message,
  );
}

@Injectable()
export class RollingGoTravelQuoteAdapter implements ITravelQuotePort {
  private readonly logger = new Logger(RollingGoTravelQuoteAdapter.name);

  constructor(private readonly rollingGo: RollingGoMcpClient) {}

  async enrich(
    activity: ActivityRecord,
    dto: GenerateTravelGuideDto,
    mapCtx: TravelGuideMapContext,
    accommodationNights: number,
    options?: TravelQuoteEnrichOptions,
  ): Promise<TravelQuoteEnrichment | null> {
    if (!this.rollingGo.enabled) {
      this.logger.log(
        'RollingGo quote enrichment skipped: ROLLINGGO_ENABLED=false or missing API key',
      );
      return null;
    }

    const query = buildTravelQuoteQuery(
      activity,
      dto,
      mapCtx,
      accommodationNights,
    );
    if (!query) {
      this.logger.log(
        `RollingGo quote enrichment skipped: same-city trip (departure="${dto.departure.trim()}", activity="${activity.location ?? ''}", mapInterCity=${Boolean(mapCtx.interCity)})`,
      );
      return null;
    }

    this.logger.log(
      `RollingGo quote enrichment start: ${query.departureText} → ${query.destinationCity} outbound=${query.outboundDate}${dto.forceRegenerate ? ' (forceRegenerate)' : ''}`,
    );

    const mcpOptions: RollingGoMcpCallOptions | undefined = dto.forceRegenerate
      ? { skipCache: true }
      : undefined;

    try {
      let hotelByTier: Partial<
        Record<TravelGuideBudgetTier, HotelQuoteSnapshot>
      > | null = null;

      if (accommodationNights > 0 && !options?.skipHotels) {
        await reportTravelGuideProgress(options?.onProgress, 'quotes_hotels');
        this.logger.log(
          `RollingGo hotel tier quotes start: ${query.destinationCity} nights=${accommodationNights} checkIn=${query.outboundDate}`,
        );
        hotelByTier = await this.fetchHotelTierQuotes(
          query,
          [query.budgetTier],
          mcpOptions,
        );
      } else if (options?.skipHotels && accommodationNights > 0) {
        this.logger.log(
          `RollingGo hotel quotes skipped (RouteStack owns EN stays) destination=${query.destinationCity}`,
        );
      }

      await reportTravelGuideProgress(options?.onProgress, 'quotes_flights');
      this.logger.log(
        `RollingGo flight tier quotes start: ${query.departureText} → ${query.destinationCity}`,
      );

      let flightByTier: Partial<
        Record<TravelGuideBudgetTier, FlightQuoteSnapshot>
      > = {};
      try {
        flightByTier = await this.fetchFlightTierQuotes(
          query,
          SYNC_BUDGET_TIER_ORDER,
          mcpOptions,
        );
      } catch (error) {
        this.logger.warn(
          `RollingGo flight quote failed: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
      const flight =
        flightByTier?.[query.budgetTier] ??
        (flightByTier
          ? (Object.values(flightByTier).find(Boolean) ?? null)
          : null);
      const hotel =
        hotelByTier?.[query.budgetTier] ??
        (hotelByTier
          ? (Object.values(hotelByTier).find(Boolean) ?? null)
          : null);

      if (!flight && !hotel) {
        this.logger.log(
          'RollingGo quote enrichment finished: no flight/hotel offers (see prior airport/hotel resolution logs)',
        );
        return null;
      }
      this.logger.log(
        `RollingGo quote enrichment done: flight=${flight ? `${flight.minPricePerAdult}-${flight.maxPricePerAdult} (${flight.cabinLabel ?? '经济舱'})` : 'none'} tiers=${flightByTier ? Object.keys(flightByTier).length : 0} hotel=${hotel ? `${hotel.minPricePerNight}-${hotel.maxPricePerNight}` : 'none'}`,
      );
      return {
        ...(flight ? { flight } : {}),
        ...(flightByTier && Object.keys(flightByTier).length
          ? { flightByTier }
          : {}),
        ...(hotel ? { hotel } : {}),
        ...(hotelByTier && Object.keys(hotelByTier).length
          ? { hotelByTier }
          : {}),
      };
    } catch (error) {
      this.logger.warn(
        `RollingGo quote enrichment skipped: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  async fetchHotelQuoteForTier(
    query: TravelQuoteQuery,
    tier: TravelGuideBudgetTier,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<HotelQuoteSnapshot | null> {
    const grade = mapSyncBudgetTierToRollingGoHotelGrade(tier);
    return this.fetchHotelQuoteImpl(query, mcpOptions, { tier, grade });
  }

  async fetchFlightQuoteForTier(
    query: TravelQuoteQuery,
    tier: TravelGuideBudgetTier,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<FlightQuoteSnapshot | null> {
    const route = await this.resolveWorkingFlightRoute(query, mcpOptions);
    if (!route) return null;
    return this.fetchFlightQuoteForTierImpl(
      query,
      route.fromCity,
      route.toCity,
      tier,
      mcpOptions,
      route.flightWindow,
    );
  }

  private buildGeoContext(query: TravelQuoteQuery) {
    return buildRollingGoQuoteGeoContext({
      activityLegacyId: query.activityLegacyId,
      activityName: query.activityName,
      activityCode: query.activityCode,
      activityArea: query.activityArea,
      location: query.activityLocation ?? query.destinationCity,
      venueTitle: query.venueTitle,
      venueAddress: query.venueAddress,
      regionKind: query.regionKind,
    });
  }

  private async fetchFlightTierQuotes(
    query: TravelQuoteQuery,
    tiers: TravelGuideBudgetTier[],
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<Partial<Record<TravelGuideBudgetTier, FlightQuoteSnapshot>>> {
    const route = await this.resolveWorkingFlightRoute(query, mcpOptions);
    if (!route) return {};

    const flightByTier: Partial<
      Record<TravelGuideBudgetTier, FlightQuoteSnapshot>
    > = {};
    const cabinOfferCache = new Map<
      RollingGoCabinGrade,
      {
        offers: Awaited<ReturnType<RollingGoMcpClient['searchFlights']>>;
        returnDate?: string;
      }
    >();

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i]!;
      const quote = await this.fetchFlightQuoteForTierImpl(
        query,
        route.fromCity,
        route.toCity,
        tier,
        mcpOptions,
        route.flightWindow,
        cabinOfferCache,
      );
      if (quote) {
        flightByTier[tier] = quote;
      }
      if (i < tiers.length - 1) {
        await sleep(FLIGHT_TIER_GAP_MS);
      }
    }

    this.logger.log(
      `RollingGo flight tier quotes done: ${Object.keys(flightByTier).length}/${tiers.length} tiers${route.flightWindow.returnDate ? ` ret=${route.flightWindow.returnDate}` : ''} via ${route.fromCity}→${route.toCity}`,
    );

    return flightByTier;
  }

  /**
   * Pick fromCity + first destination airport that actually returns offers.
   * Tries activity primary → alternate IATAs; MCP keywords only when no static IATA.
   */
  private async resolveWorkingFlightRoute(
    query: TravelQuoteQuery,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<{
    fromCity: string;
    toCity: string;
    source: string;
    flightWindow: ResolvedFlightWindow;
  } | null> {
    const resolved = await this.resolveFlightAirportCandidates(
      query,
      mcpOptions,
    );
    if (!resolved) return null;

    const tryCandidates = async (
      candidates: FlightAirportCandidate[],
    ): Promise<{
      fromCity: string;
      toCity: string;
      source: string;
      flightWindow: ResolvedFlightWindow;
    } | null> => {
      for (let i = 0; i < candidates.length; i++) {
        const candidate = candidates[i]!;
        const flightWindow = await this.resolveFlightWindow(
          query,
          resolved.fromCity,
          candidate.toCity,
          mcpOptions,
        );
        const hasOffers = await this.probeFlightSearch(
          query,
          resolved.fromCity,
          candidate.toCity,
          'ECONOMY',
          flightWindow.returnDate,
          mcpOptions,
        );
        if (hasOffers) {
          this.logger.log(
            `RollingGo flight airports: ${resolved.fromCity} → ${candidate.toCity} (${candidate.source})`,
          );
          return {
            fromCity: resolved.fromCity,
            toCity: candidate.toCity,
            source: candidate.source,
            flightWindow,
          };
        }
        this.logger.log(
          `RollingGo flight no offers probing ${resolved.fromCity}→${candidate.toCity} (${candidate.source})`,
        );
      }
      return null;
    };

    const hit = await tryCandidates(resolved.toCities);
    if (hit) return hit;

    const primary = resolved.toCities[0];
    if (!primary) return null;

    const flightWindow = await this.resolveFlightWindow(
      query,
      resolved.fromCity,
      primary.toCity,
      mcpOptions,
    );
    this.logger.log(
      `RollingGo flight airports: ${resolved.fromCity} → ${primary.toCity} (${primary.source}, no inventory on any candidate)`,
    );
    return {
      fromCity: resolved.fromCity,
      toCity: primary.toCity,
      source: primary.source,
      flightWindow,
    };
  }

  private async resolveFlightAirportCandidates(
    query: TravelQuoteQuery,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<{
    fromCity: string;
    toCities: FlightAirportCandidate[];
  } | null> {
    const geo = this.buildGeoContext(query);
    const departureCity = resolveDepartureCityLabel(
      query.departureText,
      query.departureCity,
    );
    const flightUrl = this.rollingGo.flightMcpUrl;

    const fromCity =
      resolveKnownDepartureCityCode(departureCity) ??
      (await this.resolveAirportCityCode(departureCity, flightUrl, mcpOptions));

    const toCities: FlightAirportCandidate[] = [];
    const seen = new Set<string>();
    const pushTo = (code: string | undefined, source: string) => {
      const normalized = code?.trim().toUpperCase();
      if (!normalized || normalized.length !== 3 || seen.has(normalized)) {
        return;
      }
      seen.add(normalized);
      toCities.push({ toCity: normalized, source });
    };

    if (geo.destinationCityCode) {
      pushTo(geo.destinationCityCode, 'activity/hot-path/known IATA');
    } else {
      pushTo(
        resolveKnownDestinationCityCode(geo.destinationCity),
        'known destination city',
      );
    }

    for (const alt of resolveActivityAlternateAirportCodes(
      query.activityLegacyId,
    )) {
      pushTo(alt, 'activity alternate IATA');
    }

    // MCP keywords only when we still have no destination — never as a way to
    // "recover" inventory via country hubs (e.g. LAX after CMH/CLE are dry).
    if (!toCities.length) {
      const keywordCities = await this.resolveKeywordAirportCandidates(
        query,
        mcpOptions,
        seen,
      );
      toCities.push(...keywordCities);
    }

    if (!fromCity || !toCities.length) {
      this.logger.log(
        `RollingGo flight unresolved: from=${fromCity ?? 'none'} (${departureCity}) to=none (keywords=${geo.airportKeywords.join('|')}, iata=${geo.destinationCityCode ?? 'none'}, raw=${query.destinationCity})`,
      );
      return null;
    }

    return { fromCity, toCities };
  }

  private async resolveKeywordAirportCandidates(
    query: TravelQuoteQuery,
    mcpOptions: RollingGoMcpCallOptions | undefined,
    alreadySeen: Set<string>,
  ): Promise<FlightAirportCandidate[]> {
    const geo = this.buildGeoContext(query);
    const flightUrl = this.rollingGo.flightMcpUrl;
    const out: FlightAirportCandidate[] = [];
    const seen = new Set(alreadySeen);

    const keywordCodes = await Promise.all(
      geo.airportKeywords.map(async (keyword) => ({
        keyword,
        code: await this.resolveAirportCityCode(keyword, flightUrl, mcpOptions),
      })),
    );
    for (const { keyword, code } of keywordCodes) {
      const normalized = code?.trim().toUpperCase();
      if (!normalized || normalized.length !== 3 || seen.has(normalized)) {
        continue;
      }
      seen.add(normalized);
      out.push({ toCity: normalized, source: `keyword=${keyword}` });
    }
    return out;
  }

  private async fetchFlightQuoteForTierImpl(
    query: TravelQuoteQuery,
    fromCity: string,
    toCity: string,
    tier: TravelGuideBudgetTier,
    mcpOptions?: RollingGoMcpCallOptions,
    flightWindow?: ResolvedFlightWindow,
    cabinOfferCache?: Map<
      RollingGoCabinGrade,
      {
        offers: Awaited<ReturnType<RollingGoMcpClient['searchFlights']>>;
        returnDate?: string;
      }
    >,
  ): Promise<FlightQuoteSnapshot | null> {
    const locale = query.locale === 'en' ? 'en' : 'zh';
    const cabinGrades = rollingGoCabinGradesForBudgetTier(tier);
    const requestedCabinLabel = rollingGoCabinLabelForBudgetTier(tier, locale);
    const window =
      flightWindow ??
      (await this.resolveFlightWindow(query, fromCity, toCity, mcpOptions));

    for (const cabinGrade of cabinGrades) {
      const flightSearch =
        cabinOfferCache?.get(cabinGrade) ??
        (await this.searchFlightOffersInWindow(
          query,
          fromCity,
          toCity,
          mcpOptions,
          cabinGrade,
          window,
        ));
      if (flightSearch && cabinOfferCache && !cabinOfferCache.has(cabinGrade)) {
        cabinOfferCache.set(cabinGrade, flightSearch);
      }
      if (!flightSearch) continue;

      const { offers, returnDate } = flightSearch;
      const cabinLabel = rollingGoCabinGradeLabel(cabinGrade, locale);
      const cabinFallback = cabinGrade !== cabinGrades[0]!;
      const summary = summarizeFlightOffers(
        offers,
        query.regionKind === 'overseas' ? 3 : 2,
        cabinLabel,
        locale,
      );
      if (!summary.min || !summary.max) continue;

      if (cabinFallback) {
        this.logger.log(
          `RollingGo flight tier=${tier} cabin fallback=${cabinLabel}`,
        );
      }

      const sourceCurrency = resolveFlightOfferCurrency(offers);

      return {
        fromCityCode: fromCity,
        toCityCode: toCity,
        outboundDate: query.outboundDate,
        returnDate,
        // EN plans convert CNY quotes to USD for display; keep currency aligned.
        currency: locale === 'en' ? 'USD' : sourceCurrency,
        minPricePerAdult: summary.min,
        maxPricePerAdult: summary.max,
        sampleLines: summary.sampleLines,
        flightOffers: summary.flightOffers,
        cabinLabel,
        requestedCabinLabel,
        cabinFallback,
        fetchedAt: new Date().toISOString(),
        source: 'rollinggo',
      };
    }

    this.logger.log(
      `RollingGo flight no offers for tier=${tier}: ${fromCity}→${toCity} ${query.outboundDate}`,
    );
    return null;
  }

  /** 先用经济舱探测可用返程日，避免三档×多舱位重复扫日期。 */
  private async resolveFlightWindow(
    query: TravelQuoteQuery,
    fromCity: string,
    toCity: string,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<ResolvedFlightWindow> {
    if (!query.returnDate) {
      return { tripType: 'ONE_WAY' };
    }

    const retCandidates = [
      query.returnDate,
      addDays(query.returnDate, 1),
      addDays(query.returnDate, 2),
    ];

    for (let i = 0; i < retCandidates.length; i++) {
      const retDate = retCandidates[i];
      const probe = await this.probeFlightSearch(
        query,
        fromCity,
        toCity,
        'ECONOMY',
        retDate,
        mcpOptions,
      );
      if (probe) {
        if (i > 0) {
          this.logger.log(
            `RollingGo flight return date recovered: ${retDate} (planned ${query.returnDate})`,
          );
        }
        return { tripType: 'ROUND_TRIP', returnDate: retDate };
      }
    }

    return { tripType: 'ROUND_TRIP', returnDate: query.returnDate };
  }

  private async probeFlightSearch(
    query: TravelQuoteQuery,
    fromCity: string,
    toCity: string,
    cabinGrade: RollingGoCabinGrade,
    retDate: string | undefined,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < FLIGHT_SEARCH_MAX_ATTEMPTS; attempt++) {
      const { offers, message } = await this.rollingGo.searchFlightsDetailed(
        {
          adultNumber: query.headcount,
          childNumber: 0,
          cabinGrade,
          tripType: retDate ? 'ROUND_TRIP' : 'ONE_WAY',
          fromCity,
          toCity,
          fromDate: query.outboundDate,
          ...(retDate ? { retDate } : {}),
        },
        mcpOptions,
      );

      const summary = summarizeFlightOffers(
        offers,
        query.regionKind === 'overseas' ? 3 : 2,
      );
      if (summary.min && summary.max) {
        return true;
      }

      if (
        isTransientRollingGoFlightFailure(message) &&
        attempt < FLIGHT_SEARCH_MAX_ATTEMPTS - 1
      ) {
        await sleep(FLIGHT_SEARCH_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      if (attempt === 0 && retDate) {
        this.logger.log(
          `RollingGo flight probe: ${fromCity}→${toCity} ${query.outboundDate} ret ${retDate}${message ? ` (${message})` : ''}`,
        );
      }
      break;
    }

    return false;
  }

  private async searchFlightOffersInWindow(
    query: TravelQuoteQuery,
    fromCity: string,
    toCity: string,
    mcpOptions: RollingGoMcpCallOptions | undefined,
    cabinGrade: RollingGoCabinGrade,
    window: ResolvedFlightWindow,
  ): Promise<{
    offers: Awaited<ReturnType<RollingGoMcpClient['searchFlights']>>;
    returnDate?: string;
  } | null> {
    for (let attempt = 0; attempt < FLIGHT_SEARCH_MAX_ATTEMPTS; attempt++) {
      const { offers, message } = await this.rollingGo.searchFlightsDetailed(
        {
          adultNumber: query.headcount,
          childNumber: 0,
          cabinGrade,
          tripType: window.tripType,
          fromCity,
          toCity,
          fromDate: query.outboundDate,
          ...(window.returnDate ? { retDate: window.returnDate } : {}),
        },
        mcpOptions,
      );

      const summary = summarizeFlightOffers(
        offers,
        query.regionKind === 'overseas' ? 3 : 2,
      );
      if (summary.min && summary.max) {
        return { offers, returnDate: window.returnDate };
      }

      if (
        isTransientRollingGoFlightFailure(message) &&
        attempt < FLIGHT_SEARCH_MAX_ATTEMPTS - 1
      ) {
        await sleep(FLIGHT_SEARCH_RETRY_DELAY_MS * (attempt + 1));
        continue;
      }

      return null;
    }

    return null;
  }

  private async fetchHotelTierQuotes(
    query: TravelQuoteQuery,
    tiers: TravelGuideBudgetTier[],
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<Partial<Record<TravelGuideBudgetTier, HotelQuoteSnapshot>>> {
    const geo = this.buildGeoContext(query);
    const tierRawHotels: Partial<
      Record<TravelGuideBudgetTier, RollingGoHotelRecord[]>
    > = {};

    for (const tier of tiers) {
      const grade = mapSyncBudgetTierToRollingGoHotelGrade(tier);
      this.logger.log(
        `RollingGo hotel tier=${tier} grade=${rollingGoHotelGradeLabel(grade)} place=${query.destinationCity}`,
      );
      const hotels = await this.searchHotelsForTier(query, tier, mcpOptions);
      tierRawHotels[tier] = hotels;
      this.logger.log(
        `RollingGo hotel tier=${tier} raw=${hotels.length} priced=${hotels.filter((h) => h.minPrice != null && h.minPrice > 0).length}`,
      );
    }

    const hotelByTier = buildDiversifiedRollingGoHotelQuotesByTier(
      tierRawHotels,
      {
        regionKind: query.regionKind,
        countryCode:
          query.regionKind === 'overseas' ? geo.hotelCountryCode : 'CN',
        venueCoords: geo.venueCoords,
      },
    );

    for (const tier of tiers) {
      const quote = hotelByTier[tier];
      if (quote) {
        this.logger.log(
          `RollingGo hotel tier=${tier} ok: ¥${quote.minPricePerNight}-${quote.maxPricePerNight}/晚 recs=${quote.recommendations?.length ?? 0} lead=${quote.recommendations?.[0]?.name ?? 'none'}`,
        );
      } else {
        this.logger.log(`RollingGo hotel tier=${tier} no offers`);
      }
    }

    this.logger.log(
      `RollingGo hotel tier quotes done: ${Object.keys(hotelByTier).length}/${tiers.length} tiers`,
    );

    return hotelByTier;
  }

  private async searchHotelsForTier(
    query: TravelQuoteQuery,
    tier: TravelGuideBudgetTier,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<RollingGoHotelRecord[]> {
    const geo = this.buildGeoContext(query);
    const countryCode =
      query.regionKind === 'overseas' ? geo.hotelCountryCode : 'CN';
    const grade = mapSyncBudgetTierToRollingGoHotelGrade(tier);

    const searchArgs = {
      originQuery: buildRollingGoHotelOriginQuery(query),
      ...(countryCode ? { countryCode } : {}),
      checkInParam: {
        checkInDate: query.outboundDate,
        stayNights: query.accommodationNights,
      },
      filterOptions: {
        starRatings: rollingGoHotelGradeStarRatings(grade),
      },
      size: 15,
    };

    const venueHotels = await this.rollingGo.searchHotels(
      {
        ...searchArgs,
        place: geo.hotelPlace,
        placeType: geo.hotelSearchPlaceType,
        filterOptions: {
          ...searchArgs.filterOptions,
          ...(geo.hotelSearchPlaceType === '景点'
            ? { distanceInMeter: 15_000 }
            : {}),
        },
      },
      mcpOptions,
    );

    const shouldCityFallback =
      query.regionKind === 'overseas' &&
      geo.hotelSearchPlaceType === '景点' &&
      geo.destinationCity.trim().length > 0 &&
      venueHotels.filter((h) => h.minPrice != null && h.minPrice > 0).length <
        3;

    if (!shouldCityFallback) {
      return venueHotels;
    }

    this.logger.log(
      `RollingGo hotel tier=${tier} venue pool=${venueHotels.length}, fallback city=${geo.destinationCity}`,
    );

    const cityHotels = await this.rollingGo.searchHotels(
      {
        ...searchArgs,
        place: geo.destinationCity,
        placeType: '城市',
      },
      mcpOptions,
    );

    const merged = new Map<string, RollingGoHotelRecord>();
    for (const hotel of [...venueHotels, ...cityHotels]) {
      const key = hotel.name?.trim().toLowerCase();
      if (!key) continue;
      merged.set(key, hotel);
    }
    return [...merged.values()];
  }

  private async fetchHotelQuoteImpl(
    query: TravelQuoteQuery,
    mcpOptions?: RollingGoMcpCallOptions,
    tierOverride?: {
      tier: TravelGuideBudgetTier;
      grade: ReturnType<typeof mapSyncBudgetTierToRollingGoHotelGrade>;
    },
  ): Promise<HotelQuoteSnapshot | null> {
    const geo = this.buildGeoContext(query);
    const tier = tierOverride?.tier ?? query.budgetTier;

    const hotels = await this.searchHotelsForTier(query, tier, mcpOptions);
    const quotes = buildDiversifiedRollingGoHotelQuotesByTier(
      { [tier]: hotels },
      {
        regionKind: query.regionKind,
        countryCode:
          query.regionKind === 'overseas' ? geo.hotelCountryCode : 'CN',
        venueCoords: geo.venueCoords,
      },
    );

    return quotes[tier] ?? null;
  }

  private async resolveAirportCityCode(
    keyword: string,
    flightUrl: string,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<string | undefined> {
    try {
      const records = await this.rollingGo.searchAirports(
        keyword,
        flightUrl,
        mcpOptions,
      );
      return pickCityCode(records);
    } catch {
      return undefined;
    }
  }
}
