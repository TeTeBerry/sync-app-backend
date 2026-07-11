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
  resolveKnownDepartureAirportCode,
  resolveKnownDestinationCityCode,
  rollingGoAirportSearchKeywords,
} from '../../domain/travel-guide-departure-airport.util';
import { buildRollingGoQuoteGeoContext } from '../../domain/travel-guide-rollinggo-geo.util';
import { resolveActivityAlternateAirportCodes } from '@src/data/travel-guide/travel-guide-activity-airports.data';
import {
  airportEndpoint,
  buildRollingGoFlightSearchArgs,
  formatFlightEndpoint,
  flightEndpointCode,
  listFlightEndpointSearchModes,
  sameFlightEndpoint,
  type FlightEndpointQueryMode,
  type RollingGoFlightEndpoint,
} from '../../domain/rollinggo-flight-endpoint.util';
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
  pickFlightEndpoint,
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
  /** Probe-proven city/airport mode — reuse for cabin/tier searches. */
  preferredMode?: FlightEndpointQueryMode;
};

type FlightDestinationCandidate = {
  to: RollingGoFlightEndpoint;
  /** How this destination was chosen (for logs). */
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
      route.from,
      route.to,
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
        from: RollingGoFlightEndpoint;
        to: RollingGoFlightEndpoint;
      }
    >();

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i]!;
      const quote = await this.fetchFlightQuoteForTierImpl(
        query,
        route.from,
        route.to,
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
      `RollingGo flight tier quotes done: ${Object.keys(flightByTier).length}/${tiers.length} tiers${route.flightWindow.returnDate ? ` ret=${route.flightWindow.returnDate}` : ''} via ${formatFlightEndpoint(route.from)}→${formatFlightEndpoint(route.to)}`,
    );

    return flightByTier;
  }

  /**
   * Resolve from/to endpoints per official RollingGo contract, then pick the
   * first destination that returns offers (primary airport → alternates).
   */
  private async resolveWorkingFlightRoute(
    query: TravelQuoteQuery,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<{
    from: RollingGoFlightEndpoint;
    to: RollingGoFlightEndpoint;
    source: string;
    flightWindow: ResolvedFlightWindow;
  } | null> {
    const resolved = await this.resolveFlightEndpointCandidates(
      query,
      mcpOptions,
    );
    if (!resolved) return null;

    const tryCandidates = async (
      candidates: FlightDestinationCandidate[],
    ): Promise<{
      from: RollingGoFlightEndpoint;
      to: RollingGoFlightEndpoint;
      source: string;
      flightWindow: ResolvedFlightWindow;
    } | null> => {
      for (const candidate of candidates) {
        const flightWindow = await this.resolveFlightWindow(
          query,
          resolved.from,
          candidate.to,
          mcpOptions,
        );

        let preferredMode = flightWindow.preferredMode;
        // Round-trip window scan already probed return dates; only re-probe
        // for one-way (no dates scanned) or when window found no inventory.
        if (!preferredMode && flightWindow.tripType === 'ONE_WAY') {
          preferredMode =
            (await this.probeFlightSearch(
              query,
              resolved.from,
              candidate.to,
              'ECONOMY',
              undefined,
              mcpOptions,
            )) ?? undefined;
        }

        if (preferredMode) {
          this.logger.log(
            `RollingGo flight airports: ${formatFlightEndpoint(resolved.from)} → ${formatFlightEndpoint(candidate.to)} (${candidate.source}) via ${formatFlightEndpoint(preferredMode.from)}→${formatFlightEndpoint(preferredMode.to)}`,
          );
          return {
            from: resolved.from,
            to: candidate.to,
            source: candidate.source,
            flightWindow: { ...flightWindow, preferredMode },
          };
        }
        this.logger.log(
          `RollingGo flight no offers probing ${formatFlightEndpoint(resolved.from)}→${formatFlightEndpoint(candidate.to)} (${candidate.source})`,
        );
      }
      return null;
    };

    const hit = await tryCandidates(resolved.toCandidates);
    if (hit) return hit;

    const primary = resolved.toCandidates[0];
    if (!primary) return null;

    const flightWindow = await this.resolveFlightWindow(
      query,
      resolved.from,
      primary.to,
      mcpOptions,
    );
    this.logger.log(
      `RollingGo flight airports: ${formatFlightEndpoint(resolved.from)} → ${formatFlightEndpoint(primary.to)} (${primary.source}, no inventory on any candidate)`,
    );
    return {
      from: resolved.from,
      to: primary.to,
      source: primary.source,
      flightWindow,
    };
  }

  private async resolveFlightEndpointCandidates(
    query: TravelQuoteQuery,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<{
    from: RollingGoFlightEndpoint;
    toCandidates: FlightDestinationCandidate[];
  } | null> {
    const geo = this.buildGeoContext(query);
    const departureCity = resolveDepartureCityLabel(
      query.departureText,
      query.departureCity,
    );
    const flightUrl = this.rollingGo.flightMcpUrl;

    const knownFrom = airportEndpoint(
      resolveKnownDepartureAirportCode(departureCity) ?? '',
    );
    const from =
      knownFrom ??
      (await this.resolveFlightEndpointFromKeywords(
        rollingGoAirportSearchKeywords(departureCity),
        flightUrl,
        mcpOptions,
      ));

    const toCandidates: FlightDestinationCandidate[] = [];
    const seen: RollingGoFlightEndpoint[] = [];
    const pushTo = (
      endpoint: RollingGoFlightEndpoint | undefined,
      source: string,
    ) => {
      if (!endpoint) return;
      if (seen.some((item) => sameFlightEndpoint(item, endpoint))) return;
      seen.push(endpoint);
      toCandidates.push({ to: endpoint, source });
    };

    // Activity / hot-path / known destination maps are airport IATA → toAirport.
    if (geo.destinationCityCode) {
      pushTo(
        airportEndpoint(geo.destinationCityCode),
        'activity/hot-path airport IATA',
      );
    } else {
      pushTo(
        airportEndpoint(
          resolveKnownDestinationCityCode(geo.destinationCity) ?? '',
        ),
        'known destination airport',
      );
    }

    for (const alt of resolveActivityAlternateAirportCodes(
      query.activityLegacyId,
    )) {
      pushTo(airportEndpoint(alt), 'activity alternate airport');
    }

    if (!toCandidates.length) {
      const keywordEndpoints = await this.resolveKeywordDestinationEndpoints(
        query,
        mcpOptions,
        seen,
      );
      toCandidates.push(...keywordEndpoints);
    }

    if (!from || !toCandidates.length) {
      this.logger.log(
        `RollingGo flight unresolved: from=${from ? formatFlightEndpoint(from) : 'none'} (${departureCity}) to=none (keywords=${geo.airportKeywords.join('|')}, iata=${geo.destinationCityCode ?? 'none'}, raw=${query.destinationCity})`,
      );
      return null;
    }

    return { from, toCandidates };
  }

  private async resolveKeywordDestinationEndpoints(
    query: TravelQuoteQuery,
    mcpOptions: RollingGoMcpCallOptions | undefined,
    alreadySeen: RollingGoFlightEndpoint[],
  ): Promise<FlightDestinationCandidate[]> {
    const geo = this.buildGeoContext(query);
    const flightUrl = this.rollingGo.flightMcpUrl;
    const out: FlightDestinationCandidate[] = [];
    const seen = [...alreadySeen];

    for (const keyword of geo.airportKeywords) {
      const searchKeywords = rollingGoAirportSearchKeywords(keyword);
      const endpoint = await this.resolveFlightEndpointFromKeywords(
        searchKeywords.length ? searchKeywords : [keyword],
        flightUrl,
        mcpOptions,
      );
      if (!endpoint) continue;
      if (seen.some((item) => sameFlightEndpoint(item, endpoint))) continue;
      seen.push(endpoint);
      out.push({ to: endpoint, source: `keyword=${keyword}` });
    }
    return out;
  }

  private async fetchFlightQuoteForTierImpl(
    query: TravelQuoteQuery,
    from: RollingGoFlightEndpoint,
    to: RollingGoFlightEndpoint,
    tier: TravelGuideBudgetTier,
    mcpOptions?: RollingGoMcpCallOptions,
    flightWindow?: ResolvedFlightWindow,
    cabinOfferCache?: Map<
      RollingGoCabinGrade,
      {
        offers: Awaited<ReturnType<RollingGoMcpClient['searchFlights']>>;
        returnDate?: string;
        from: RollingGoFlightEndpoint;
        to: RollingGoFlightEndpoint;
      }
    >,
  ): Promise<FlightQuoteSnapshot | null> {
    const locale = query.locale === 'en' ? 'en' : 'zh';
    const cabinGrades = rollingGoCabinGradesForBudgetTier(tier);
    const requestedCabinLabel = rollingGoCabinLabelForBudgetTier(tier, locale);
    const window =
      flightWindow ??
      (await this.resolveFlightWindow(query, from, to, mcpOptions));

    for (const cabinGrade of cabinGrades) {
      const flightSearch =
        cabinOfferCache?.get(cabinGrade) ??
        (await this.searchFlightOffersInWindow(
          query,
          from,
          to,
          mcpOptions,
          cabinGrade,
          window,
        ));
      if (flightSearch && cabinOfferCache && !cabinOfferCache.has(cabinGrade)) {
        cabinOfferCache.set(cabinGrade, flightSearch);
      }
      if (!flightSearch) continue;

      const { offers, returnDate, from: usedFrom, to: usedTo } = flightSearch;
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
        fromCityCode: flightEndpointCode(usedFrom),
        toCityCode: flightEndpointCode(usedTo),
        outboundDate: query.outboundDate,
        returnDate,
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
      `RollingGo flight no offers for tier=${tier}: ${formatFlightEndpoint(from)}→${formatFlightEndpoint(to)} ${query.outboundDate}`,
    );
    return null;
  }

  /** 先用经济舱探测可用返程日，避免三档×多舱位重复扫日期。 */
  private async resolveFlightWindow(
    query: TravelQuoteQuery,
    from: RollingGoFlightEndpoint,
    to: RollingGoFlightEndpoint,
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
      const preferredMode = await this.probeFlightSearch(
        query,
        from,
        to,
        'ECONOMY',
        retDate,
        mcpOptions,
      );
      if (preferredMode) {
        if (i > 0) {
          this.logger.log(
            `RollingGo flight return date recovered: ${retDate} (planned ${query.returnDate})`,
          );
        }
        return {
          tripType: 'ROUND_TRIP',
          returnDate: retDate,
          preferredMode,
        };
      }
    }

    return { tripType: 'ROUND_TRIP', returnDate: query.returnDate };
  }

  private async probeFlightSearch(
    query: TravelQuoteQuery,
    from: RollingGoFlightEndpoint,
    to: RollingGoFlightEndpoint,
    cabinGrade: RollingGoCabinGrade,
    retDate: string | undefined,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<FlightEndpointQueryMode | null> {
    for (const mode of listFlightEndpointSearchModes(from, to)) {
      for (let attempt = 0; attempt < FLIGHT_SEARCH_MAX_ATTEMPTS; attempt++) {
        const { offers, message } = await this.rollingGo.searchFlightsDetailed(
          buildRollingGoFlightSearchArgs({
            adultNumber: query.headcount,
            childNumber: 0,
            cabinGrade,
            tripType: retDate ? 'ROUND_TRIP' : 'ONE_WAY',
            fromDate: query.outboundDate,
            ...(retDate ? { retDate } : {}),
            from: mode.from,
            to: mode.to,
          }),
          mcpOptions,
        );

        const summary = summarizeFlightOffers(
          offers,
          query.regionKind === 'overseas' ? 3 : 2,
        );
        if (summary.min && summary.max) {
          return mode;
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
            `RollingGo flight probe: ${formatFlightEndpoint(mode.from)}→${formatFlightEndpoint(mode.to)} ${query.outboundDate} ret ${retDate}${message ? ` (${message})` : ''}`,
          );
        }
        break;
      }
    }

    return null;
  }

  private async searchFlightOffersInWindow(
    query: TravelQuoteQuery,
    from: RollingGoFlightEndpoint,
    to: RollingGoFlightEndpoint,
    mcpOptions: RollingGoMcpCallOptions | undefined,
    cabinGrade: RollingGoCabinGrade,
    window: ResolvedFlightWindow,
  ): Promise<{
    offers: Awaited<ReturnType<RollingGoMcpClient['searchFlights']>>;
    returnDate?: string;
    from: RollingGoFlightEndpoint;
    to: RollingGoFlightEndpoint;
  } | null> {
    for (const mode of listFlightEndpointSearchModes(
      from,
      to,
      window.preferredMode,
    )) {
      for (let attempt = 0; attempt < FLIGHT_SEARCH_MAX_ATTEMPTS; attempt++) {
        const { offers, message } = await this.rollingGo.searchFlightsDetailed(
          buildRollingGoFlightSearchArgs({
            adultNumber: query.headcount,
            childNumber: 0,
            cabinGrade,
            tripType: window.tripType,
            fromDate: query.outboundDate,
            ...(window.returnDate ? { retDate: window.returnDate } : {}),
            from: mode.from,
            to: mode.to,
          }),
          mcpOptions,
        );

        const summary = summarizeFlightOffers(
          offers,
          query.regionKind === 'overseas' ? 3 : 2,
        );
        if (summary.min && summary.max) {
          if (mode.from.kind === 'airport') {
            this.logger.log(
              `RollingGo flight endpoint fallback: city codes empty, using ${formatFlightEndpoint(mode.from)}→${formatFlightEndpoint(mode.to)}`,
            );
          }
          return {
            offers,
            returnDate: window.returnDate,
            from: mode.from,
            to: mode.to,
          };
        }

        if (
          isTransientRollingGoFlightFailure(message) &&
          attempt < FLIGHT_SEARCH_MAX_ATTEMPTS - 1
        ) {
          await sleep(FLIGHT_SEARCH_RETRY_DELAY_MS * (attempt + 1));
          continue;
        }
        break;
      }
    }

    return null;
  }

  private async resolveFlightEndpointFromKeywords(
    keywords: string[],
    flightUrl: string,
    mcpOptions?: RollingGoMcpCallOptions,
  ): Promise<RollingGoFlightEndpoint | undefined> {
    for (const keyword of keywords) {
      const trimmed = keyword.trim();
      if (!trimmed) continue;
      try {
        const records = await this.rollingGo.searchAirports(
          trimmed,
          flightUrl,
          mcpOptions,
        );
        const endpoint = pickFlightEndpoint(records);
        if (endpoint) return endpoint;
      } catch {
        // try next keyword
      }
    }
    return undefined;
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
}
