import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildFlightOfferItinerary,
  buildTravelGuideFlightOffer,
  formatFlightOfferSampleLine,
  isOutboundDirect,
} from '../../domain/travel-guide-flight-itinerary.util';
import { toDisplayAmount } from '../../domain/travel-guide-currency.util';
import { resolveHotelVenueDistanceM } from '../../domain/travel-guide-venue-distance.util';
import {
  isPlausibleFlightPrice,
  isPlausibleHotelNightlyPrice,
} from '../../domain/travel-quote-plausibility.util';
import type {
  RollingGoAirportRecord,
  RollingGoFlightOfferRecord,
  RollingGoHotelRecord,
  RollingGoMcpCallOptions,
  RollingGoMcpTextContent,
} from './rollinggo-mcp.types';

type CacheEntry<T> = { value: T; expiresAt: number };

@Injectable()
export class RollingGoMcpClient {
  private readonly logger = new Logger(RollingGoMcpClient.name);
  private readonly cache = new Map<string, CacheEntry<unknown>>();

  constructor(private readonly config: ConfigService) {}

  get enabled(): boolean {
    return (
      this.config.get<boolean>('rollinggo.enabled') === true &&
      Boolean(this.config.get<string>('rollinggo.apiKey')?.trim())
    );
  }

  async searchAirports(
    keyword: string,
    baseUrl: string,
    options?: RollingGoMcpCallOptions,
  ): Promise<RollingGoAirportRecord[]> {
    const text = await this.callTool(
      baseUrl,
      'searchAirports',
      { keyword },
      options,
    );
    return normalizeAirportRecords(this.parseToolPayload(text));
  }

  async searchFlights(
    args: Record<string, unknown>,
    options?: RollingGoMcpCallOptions,
  ): Promise<RollingGoFlightOfferRecord[]> {
    const { offers } = await this.searchFlightsDetailed(args, options);
    return offers;
  }

  async searchFlightsDetailed(
    args: Record<string, unknown>,
    options?: RollingGoMcpCallOptions,
  ): Promise<{ offers: RollingGoFlightOfferRecord[]; message?: string }> {
    const text = await this.callTool(
      this.flightMcpUrl,
      'searchFlights',
      args,
      options,
    );
    const payload = this.parseToolPayload(text);
    return {
      offers: normalizeFlightRecords(payload),
      message: rollingGoFlightSearchMessage(payload),
    };
  }

  async searchHotels(
    args: Record<string, unknown>,
    options?: RollingGoMcpCallOptions,
  ): Promise<RollingGoHotelRecord[]> {
    const text = await this.callTool(
      this.hotelUrl,
      'searchHotels',
      args,
      options,
    );
    return normalizeHotelRecords(this.parseToolPayload(text));
  }

  get flightMcpUrl(): string {
    return (
      this.config.get<string>('rollinggo.flightMcpUrl') ??
      'https://mcp.rollinggo.cn/mcp/flight'
    );
  }

  private get hotelUrl(): string {
    return (
      this.config.get<string>('rollinggo.hotelMcpUrl') ??
      'https://mcp.rollinggo.cn/mcp'
    );
  }

  private get timeoutMs(): number {
    return this.config.get<number>('rollinggo.timeoutMs') ?? 15_000;
  }

  private get flightTimeoutMs(): number {
    return this.config.get<number>('rollinggo.flightTimeoutMs') ?? 30_000;
  }

  private timeoutForTool(name: string): number {
    return name === 'searchFlights' ? this.flightTimeoutMs : this.timeoutMs;
  }

  private shouldRetryTool(name: string, error: unknown): boolean {
    if (name !== 'searchFlights') return false;
    return error instanceof Error && /aborted|abort/i.test(error.message);
  }

  private get cacheTtlMs(): number {
    const sec = this.config.get<number>('rollinggo.quoteCacheTtlSec') ?? 3600;
    return sec * 1000;
  }

  private async callTool(
    baseUrl: string,
    name: string,
    arguments_: Record<string, unknown>,
    options?: RollingGoMcpCallOptions,
  ): Promise<string> {
    const apiKey = this.config.get<string>('rollinggo.apiKey')?.trim();
    if (!apiKey) {
      throw new Error('ROLLINGGO_API_KEY is not configured');
    }

    this.logger.log(
      `RollingGo MCP call ${name} → ${baseUrl}${options?.skipCache ? ' (fresh)' : ''}`,
    );

    const timeoutMs = this.timeoutForTool(name);
    const attempt = () =>
      this.callToolOnce(baseUrl, name, arguments_, options, timeoutMs, apiKey);

    try {
      return await attempt();
    } catch (error) {
      if (this.shouldRetryTool(name, error)) {
        this.logger.warn(`RollingGo tool ${name} retry after timeout`);
        return await attempt();
      }
      this.logger.warn(
        `RollingGo tool ${name} failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      throw error;
    }
  }

  private async callToolOnce(
    baseUrl: string,
    name: string,
    arguments_: Record<string, unknown>,
    options: RollingGoMcpCallOptions | undefined,
    timeoutMs: number,
    apiKey: string,
  ): Promise<string> {
    const cacheKey = `${baseUrl}:${name}:${JSON.stringify(arguments_)}`;
    if (!options?.skipCache) {
      const cached = this.cache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        this.logger.debug(`RollingGo MCP cache hit ${name}`);
        return cached.value as string;
      }
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json, text/event-stream',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name, arguments: arguments_ },
          id: 1,
        }),
        signal: controller.signal,
      });

      const raw = await response.text();
      if (!response.ok) {
        throw new Error(
          `RollingGo MCP ${name} HTTP ${response.status}: ${raw.slice(0, 200)}`,
        );
      }

      const text = this.extractToolText(raw);
      this.cache.set(cacheKey, {
        value: text,
        expiresAt: Date.now() + this.cacheTtlMs,
      });
      return text;
    } finally {
      clearTimeout(timer);
    }
  }

  private extractToolText(raw: string): string {
    const trimmed = raw.trim();
    if (!trimmed) return '';

    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      return this.textFromJsonRpc(trimmed);
    }

    const dataLines = trimmed
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .filter(Boolean);

    if (dataLines.length) {
      return this.textFromJsonRpc(dataLines[dataLines.length - 1]!);
    }

    return trimmed;
  }

  private textFromJsonRpc(body: string): string {
    try {
      const parsed = JSON.parse(body) as {
        result?: { content?: RollingGoMcpTextContent[] };
        error?: { message?: string };
      };
      if (parsed.error?.message) {
        throw new Error(parsed.error.message);
      }
      const chunks = parsed.result?.content ?? [];
      return chunks
        .filter((c) => c.type === 'text')
        .map((c) => c.text)
        .join('\n');
    } catch (error) {
      if (error instanceof Error && error.message !== 'Unexpected token') {
        throw error;
      }
      return body;
    }
  }

  private parseToolPayload(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed) return null;

    try {
      return JSON.parse(trimmed) as unknown;
    } catch {
      return trimmed;
    }
  }
}

export function rollingGoFlightSearchMessage(
  payload: unknown,
): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const message = (payload as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim()
    ? message.trim()
    : undefined;
}

function extractList(payload: unknown, keys: string[]): unknown[] {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];

  const record = payload as Record<string, unknown>;
  for (const key of keys) {
    const nested = record[key];
    if (Array.isArray(nested)) return nested;
  }
  return [];
}

export function normalizeAirportRecords(
  payload: unknown,
): RollingGoAirportRecord[] {
  const list = extractList(payload, [
    'airPortInformationList',
    'airportInformationList',
    'data',
    'items',
  ]) as Array<Record<string, unknown>>;

  return list.map((item) => ({
    iataCode:
      String(item.airportCode ?? item.iataCode ?? '').trim() || undefined,
    airportCode:
      String(item.airportCode ?? item.iataCode ?? '').trim() || undefined,
    name: String(item.airportName ?? item.name ?? '').trim() || undefined,
    airportName:
      String(item.airportName ?? item.name ?? '').trim() || undefined,
    cityCode: String(item.cityCode ?? '').trim() || undefined,
    cityName: String(item.cityName ?? '').trim() || undefined,
    subType: /机场|airport/i.test(String(item.airportName ?? item.name ?? ''))
      ? 'AIRPORT'
      : item.subType
        ? String(item.subType)
        : undefined,
  }));
}

export function normalizeFlightRecords(
  payload: unknown,
): RollingGoFlightOfferRecord[] {
  const list = extractList(payload, [
    'flightInformationList',
    'flights',
    'data',
    'items',
  ]) as Array<Record<string, unknown>>;

  return list.map((item) => {
    const fromSegments = (item.fromSegments ??
      []) as RollingGoFlightOfferRecord['fromSegments'];
    const retSegments = (item.retSegments ??
      []) as RollingGoFlightOfferRecord['retSegments'];

    return {
      totalAdultPrice:
        typeof item.totalAdultPrice === 'number'
          ? item.totalAdultPrice
          : undefined,
      currency: String(item.currency ?? 'CNY'),
      validatingCarrier:
        String(item.validatingCarrier ?? '').trim() || undefined,
      fromSegments,
      retSegments,
      price:
        typeof item.totalAdultPrice === 'number'
          ? `¥${item.totalAdultPrice}`
          : undefined,
      itineraries: buildFlightOfferItinerary(fromSegments, retSegments),
    };
  });
}

export function normalizeHotelRecords(
  payload: unknown,
): RollingGoHotelRecord[] {
  const list = extractList(payload, [
    'hotelInformationList',
    'hotels',
    'data',
    'items',
  ]) as Array<Record<string, unknown>>;

  return list.map((item) => {
    const { minPrice, maxPrice } = extractHotelNightlyPrices(item);
    const lat = typeof item.latitude === 'number' ? item.latitude : undefined;
    const lng = typeof item.longitude === 'number' ? item.longitude : undefined;
    const distanceM =
      typeof item.distanceInMeters === 'number' && item.distanceInMeters > 0
        ? item.distanceInMeters
        : undefined;
    return {
      hotelId: item.hotelId as number | string | undefined,
      name: String(item.hotelName ?? item.name ?? '').trim() || undefined,
      minPrice,
      maxPrice,
      price: minPrice,
      starRating:
        typeof item.starRating === 'number' ? item.starRating : undefined,
      address: String(item.address ?? '').trim() || undefined,
      bookingUrl:
        typeof item.bookingUrl === 'string' && item.bookingUrl.trim()
          ? item.bookingUrl.trim()
          : undefined,
      lat,
      lng,
      distanceM,
    };
  });
}

/** RollingGo nests nightly rate under `price.lowestPrice` (CNY). */
export function extractHotelNightlyPrices(item: Record<string, unknown>): {
  minPrice?: number;
  maxPrice?: number;
} {
  const priceBlock = item.price;
  if (
    priceBlock &&
    typeof priceBlock === 'object' &&
    !Array.isArray(priceBlock)
  ) {
    const block = priceBlock as Record<string, unknown>;
    const currency = String(block.currency ?? 'CNY');
    const lowest = coercePlausibleHotelNightly(block.lowestPrice, currency);
    const highest = coercePlausibleHotelNightly(
      block.highestPrice ?? block.maxPrice,
      currency,
    );
    if (lowest != null) {
      return { minPrice: lowest, maxPrice: highest ?? lowest };
    }
    const message = String(block.message ?? '');
    const fromMessage = extractCnyPrices(message).filter((n) =>
      isPlausibleHotelNightlyPrice(n, currency),
    );
    if (fromMessage.length) {
      return {
        minPrice: fromMessage[0],
        maxPrice: fromMessage[fromMessage.length - 1],
      };
    }
  }

  const flatMin = coercePlausibleHotelNightly(
    item.minPrice ?? item.lowestPrice,
    'CNY',
  );
  const flatMax = coercePlausibleHotelNightly(
    item.maxPrice ?? item.highestPrice,
    'CNY',
  );
  if (flatMin != null) {
    return { minPrice: flatMin, maxPrice: flatMax ?? flatMin };
  }

  return {};
}

function coercePlausibleHotelNightly(
  value: unknown,
  currency = 'CNY',
): number | undefined {
  if (typeof value === 'number') {
    return isPlausibleHotelNightlyPrice(value, currency) ? value : undefined;
  }
  if (typeof value === 'string') {
    const parsed = extractCnyPrices(value).find((n) =>
      isPlausibleHotelNightlyPrice(n, currency),
    );
    return parsed;
  }
  return undefined;
}

/** Extract numeric prices from RollingGo text/JSON payloads. */
export function extractCnyPrices(text: string): number[] {
  const prices: number[] = [];
  const yuanMatches = text.matchAll(/[¥￥]\s*([\d,]+(?:\.\d+)?)/g);
  for (const match of yuanMatches) {
    const n = Number(match[1]?.replace(/,/g, ''));
    if (Number.isFinite(n) && n > 0) prices.push(n);
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    collectPricesFromValue(parsed, prices);
  } catch {
    // ignore
  }

  return [...new Set(prices)].sort((a, b) => a - b);
}

function collectPricesFromValue(value: unknown, out: number[]): void {
  if (value == null) return;
  if (typeof value === 'number' && value > 0) {
    out.push(value);
    return;
  }
  if (typeof value === 'string') {
    const fromStr = extractCnyPrices(value);
    out.push(...fromStr);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectPricesFromValue(item, out);
    return;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    for (const [key, v] of Object.entries(record)) {
      if (isKnownPriceField(key)) {
        collectPricesFromValue(v, out);
        continue;
      }
      if (key === 'price' && v && typeof v === 'object' && !Array.isArray(v)) {
        collectPricesFromValue(v, out);
      }
    }
  }
}

const KNOWN_PRICE_FIELDS = new Set([
  'lowestPrice',
  'highestPrice',
  'minPrice',
  'maxPrice',
  'totalAdultPrice',
  'price',
  'message',
]);

function isKnownPriceField(key: string): boolean {
  return KNOWN_PRICE_FIELDS.has(key);
}

export function pickCityCode(
  records: RollingGoAirportRecord[],
): string | undefined {
  const normalized = records.map((r) => ({
    ...r,
    iataCode: r.iataCode ?? r.airportCode,
    subType:
      r.subType ??
      (/机场|airport/i.test(String(r.airportName ?? r.name ?? ''))
        ? 'AIRPORT'
        : undefined),
  }));

  const withCode = normalized.filter((r) => r.iataCode?.trim());
  const airport =
    withCode.find((r) => r.subType === 'AIRPORT') ??
    withCode.find((r) => /机场|airport/i.test(String(r.name ?? ''))) ??
    withCode[0];
  const code = airport?.cityCode?.trim() || airport?.iataCode?.trim();
  return code?.length === 3 ? code.toUpperCase() : undefined;
}

function flightOfferPrice(
  offer: RollingGoFlightOfferRecord,
): number | undefined {
  const currency = offer.currency ?? 'CNY';
  if (
    typeof offer.totalAdultPrice === 'number' &&
    isPlausibleFlightPrice(offer.totalAdultPrice, currency)
  ) {
    return offer.totalAdultPrice;
  }
  const parsed = extractCnyPrices(JSON.stringify(offer)).find((n) =>
    isPlausibleFlightPrice(n, currency),
  );
  return parsed;
}

export function summarizeFlightOffers(
  offers: RollingGoFlightOfferRecord[],
  limit = 2,
  cabinLabel?: string,
  locale: 'zh' | 'en' = 'zh',
): {
  min: number;
  max: number;
  sampleLines: string[];
  flightOffers: NonNullable<ReturnType<typeof buildTravelGuideFlightOffer>>[];
} {
  const prices = offers
    .map((offer) => flightOfferPrice(offer))
    .filter((n): n is number => typeof n === 'number' && n > 0)
    .sort((a, b) => a - b);

  if (!prices.length) {
    return { min: 0, max: 0, sampleLines: [], flightOffers: [] };
  }

  const rankedOffers = offers
    .map((offer) => ({
      offer,
      price: flightOfferPrice(offer),
      directRank: isOutboundDirect(offer.fromSegments) ? 0 : 1,
      transferCount: Math.max(0, (offer.fromSegments?.length ?? 1) - 1),
    }))
    .filter(
      (row): row is typeof row & { price: number } =>
        typeof row.price === 'number' && row.price > 0,
    )
    .sort(
      (a, b) =>
        a.directRank - b.directRank ||
        a.transferCount - b.transferCount ||
        a.price - b.price,
    );

  const flightOffers = rankedOffers
    .slice(0, limit)
    .map(({ offer, price }) => {
      const sourceCurrency =
        offer.currency?.toUpperCase() === 'USD' ? 'USD' : 'CNY';
      const displayCurrency = locale === 'en' ? 'USD' : sourceCurrency;
      const displayPrice =
        locale === 'en' ? toDisplayAmount(price, sourceCurrency, 'en') : price;
      return buildTravelGuideFlightOffer({
        fromSegments: offer.fromSegments,
        retSegments: offer.retSegments,
        pricePerAdult: displayPrice,
        currency: displayCurrency,
        cabinLabel,
        locale,
      });
    })
    .filter((item): item is NonNullable<typeof item> => item != null);

  const displayPrices = flightOffers
    .map((offer) => offer.pricePerAdult)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const min = displayPrices[0] ?? prices[0]!;
  const max =
    displayPrices[displayPrices.length - 1] ?? prices[prices.length - 1]!;

  const en = locale === 'en';
  const sampleLines = rankedOffers
    .slice(0, limit)
    .flatMap(({ offer, price }) => {
      const sourceCurrency =
        offer.currency?.toUpperCase() === 'USD' ? 'USD' : 'CNY';
      const displayAmount = Math.round(
        toDisplayAmount(price, sourceCurrency, locale),
      );
      const priceLabel =
        locale === 'en' || sourceCurrency === 'USD'
          ? `$${displayAmount}`
          : `¥${Math.round(price)}`;

      if (offer.fromSegments?.length || offer.retSegments?.length) {
        const line = formatFlightOfferSampleLine({
          fromSegments: offer.fromSegments,
          retSegments: offer.retSegments,
          priceLabel,
          locale,
        });
        return line ? [line] : [];
      }

      const itinerary = offer.itineraries?.[0];
      if (!itinerary?.segments) return [];
      const stops = itinerary.stops?.trim()
        ? itinerary.stops
        : en
          ? 'Direct'
          : '直飞';
      return [
        en
          ? `${itinerary.segments} · ${stops} · about ${priceLabel}/person`
          : `${itinerary.segments} · ${stops} · 约 ${priceLabel}/人`,
      ];
    });

  return { min, max, sampleLines, flightOffers };
}

export function summarizeHotelOffers(
  hotels: RollingGoHotelRecord[],
  rawText = '',
): { min: number; max: number; count: number } {
  const nightly: number[] = [];

  for (const hotel of hotels) {
    for (const field of [hotel.minPrice, hotel.maxPrice]) {
      if (typeof field === 'number' && isPlausibleHotelNightlyPrice(field)) {
        nightly.push(field);
      }
    }
  }

  if (!nightly.length && rawText.trim()) {
    nightly.push(
      ...extractCnyPrices(rawText).filter((n) =>
        isPlausibleHotelNightlyPrice(n),
      ),
    );
  }

  if (!nightly.length) {
    return { min: 0, max: 0, count: hotels.length };
  }

  nightly.sort((a, b) => a - b);
  const min = nightly[0]!;
  let max = nightly[nightly.length - 1]!;
  if (max < min) max = min;
  if (max > min * 4) {
    max = Math.round(min * 1.5);
  }
  return {
    min,
    max,
    count: hotels.length,
  };
}

/** Pick top RollingGo hotels for overseas accommodation recommendations. */
export function buildRollingGoHotelRecommendations(
  hotels: RollingGoHotelRecord[],
  limit = 6,
  venue?: { lat: number; lng: number },
  options?: {
    tier?: import('@sync/travel-guide-contracts').TravelGuideBudgetTier;
    excludeFeaturedNames?: ReadonlySet<string>;
  },
): Array<{
  name: string;
  address?: string;
  minPricePerNight?: number;
  maxPricePerNight?: number;
  starRating?: number;
  bookingUrl?: string;
  distanceM?: number;
}> {
  const tier = options?.tier ?? 'standard';
  const excludeFeaturedNames = options?.excludeFeaturedNames;

  const ranked = hotels
    .filter((h) => Boolean(h.name?.trim()))
    .filter((h) => !excludeFeaturedNames?.has(h.name!.trim()))
    .map((h) => {
      const distanceM = resolveHotelVenueDistanceM(h, venue);
      return {
        name: h.name!.trim(),
        address: h.address?.trim() || undefined,
        minPricePerNight: h.minPrice,
        maxPricePerNight: h.maxPrice ?? h.minPrice,
        starRating: h.starRating,
        bookingUrl: h.bookingUrl,
        distanceM,
        sortDistance: distanceM ?? Number.MAX_SAFE_INTEGER,
        sortKey: h.minPrice ?? Number.MAX_SAFE_INTEGER,
        sortStar: h.starRating ?? 0,
      };
    })
    .filter(
      (h) =>
        h.minPricePerNight == null ||
        isPlausibleHotelNightlyPrice(h.minPricePerNight),
    )
    .sort((a, b) => compareRollingGoHotelsForTier(a, b, tier));

  return ranked
    .slice(0, limit)
    .map(({ sortDistance: _d, sortKey: _k, sortStar: _s, ...rest }) => rest);
}

function compareRollingGoHotelsForTier(
  a: {
    sortDistance: number;
    sortKey: number;
    sortStar: number;
  },
  b: {
    sortDistance: number;
    sortKey: number;
    sortStar: number;
  },
  tier: import('@sync/travel-guide-contracts').TravelGuideBudgetTier,
): number {
  if (tier === 'economy') {
    return a.sortKey - b.sortKey || a.sortDistance - b.sortDistance;
  }
  if (tier === 'comfort') {
    return (
      b.sortStar - a.sortStar ||
      b.sortKey - a.sortKey ||
      a.sortDistance - b.sortDistance
    );
  }
  const scoreA = hotelTierCompositeScore(a);
  const scoreB = hotelTierCompositeScore(b);
  return scoreB - scoreA || a.sortDistance - b.sortDistance;
}

function hotelTierCompositeScore(hotel: {
  sortDistance: number;
  sortKey: number;
  sortStar: number;
}): number {
  const distanceScore = 1 / (1 + hotel.sortDistance / 2500);
  const priceMid = 1 - Math.min(1, Math.abs(hotel.sortKey - 520) / 520);
  const starScore = Math.min(1, hotel.sortStar / 5);
  return 0.42 * distanceScore + 0.33 * priceMid + 0.25 * starScore;
}
