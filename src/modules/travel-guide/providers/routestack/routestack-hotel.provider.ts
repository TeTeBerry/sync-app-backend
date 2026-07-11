import { Injectable, Logger } from '@nestjs/common';
import { addDays } from '../../domain/travel-guide-quote-dates.util';
import type { NormalizedHotelOption } from '../../types/normalized-hotel-option';
import type {
  HotelProvider,
  HotelSearchInput,
} from '../../providers/hotel-provider.interface';
import { RouteStackHttpClient } from '../../infra/routestack/routestack-http.client';
import {
  buildRouteStackDestinationQueries,
  buildRouteStackRooms,
  destinationCoords,
  enrichRouteStackHotelFromDetails,
  normalizeRouteStackHotels,
  pickRouteStackDestination,
  rankRouteStackHotelsForStayPreference,
} from '../../infra/routestack/routestack-hotel.util';
import type {
  RouteStackDestinationItem,
  RouteStackHotelRecord,
} from '../../infra/routestack/routestack.types';

const MAX_HOTEL_POLL_ATTEMPTS = 4;
const HOTEL_POLL_DELAY_MS = 800;
const HOTEL_RESULT_LIMIT = 15;
/** Cap destination-query retries so a dead town does not burn the whole timeout budget. */
const MAX_DESTINATION_QUERIES = 3;
const CITY_DESTINATION_TYPES = new Set([
  'city',
  'multi-city',
  'multicity',
  'region',
]);

@Injectable()
export class RouteStackHotelProvider implements HotelProvider {
  private readonly logger = new Logger(RouteStackHotelProvider.name);

  constructor(private readonly client: RouteStackHttpClient) {}

  isEnabled(): boolean {
    return this.client.isEnabled();
  }

  async searchHotels(
    input: HotelSearchInput,
  ): Promise<NormalizedHotelOption[]> {
    if (input.accommodationNights <= 0) return [];
    if (!this.isEnabled()) {
      this.logger.debug('RouteStack hotel provider disabled');
      return [];
    }

    const queries = buildRouteStackDestinationQueries({
      destinationCity: input.destinationCity,
      venueTitle: input.venue?.title,
      activityArea: input.activityArea,
      activityLocation: input.activityLocation,
      activityName: input.activityName,
    }).slice(0, MAX_DESTINATION_QUERIES);
    if (!queries.length) {
      this.logger.warn(
        'RouteStack hotel search skipped: empty destination query',
      );
      return [];
    }

    const checkIn = input.checkInDate;
    const checkOut =
      input.checkOutDate?.trim() ||
      addDays(checkIn, Math.max(1, input.accommodationNights));
    const rooms = buildRouteStackRooms(input.headcount);
    const venue = input.venue
      ? { lat: input.venue.lat, lng: input.venue.lng }
      : undefined;

    let lastError: string | undefined;
    for (const query of queries) {
      try {
        const normalized = await this.searchHotelsForQuery({
          query,
          checkIn,
          checkOut,
          rooms,
          venue,
          accommodationNights: input.accommodationNights,
          stayPreference: input.stayPreference,
        });
        if (normalized.length) {
          return normalized;
        }
        this.logger.warn(
          `RouteStack hotel search empty query="${query}" checkIn=${checkIn} checkOut=${checkOut}`,
        );
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `RouteStack hotel search failed query="${query}": ${lastError}`,
        );
      }
    }

    if (lastError) {
      this.logger.warn(
        `RouteStack hotel search exhausted queries=[${queries.join(', ')}] lastError=${lastError}`,
      );
    }
    return [];
  }

  private async searchHotelsForQuery(input: {
    query: string;
    checkIn: string;
    checkOut: string;
    rooms: ReturnType<typeof buildRouteStackRooms>;
    venue?: { lat: number; lng: number };
    accommodationNights: number;
    stayPreference?: HotelSearchInput['stayPreference'];
  }): Promise<NormalizedHotelOption[]> {
    const destinationsRes = await this.client.searchDestinations({
      query: input.query,
      type: 'DESTINATION',
    });
    const destinations = destinationsRes.result ?? [];
    const candidates = rankDestinationCandidates(destinations, input.venue);
    if (!candidates.length) {
      this.logger.warn(
        `RouteStack SearchDestinations empty for query="${input.query}"`,
      );
      return [];
    }

    for (const destination of candidates.slice(0, 2)) {
      const coords =
        destinationCoords(destination) ??
        (input.venue ? { lat: input.venue.lat, long: input.venue.lng } : null);
      if (!coords) {
        this.logger.warn(
          `RouteStack destination "${destination.fullName ?? destination.id}" missing coordinates`,
        );
        continue;
      }

      const hotels = await this.searchHotelsWithPoll({
        destinationId: destination.id,
        destinationType: destination.type,
        checkIn: input.checkIn,
        checkOut: input.checkOut,
        rooms: input.rooms,
        lat: coords.lat,
        long: coords.long,
        currency: 'USD',
        page: 1,
        limit: HOTEL_RESULT_LIMIT,
      });

      const normalized = normalizeRouteStackHotels(hotels.records, {
        accommodationNights: input.accommodationNights,
        currency: hotels.currency ?? 'USD',
        venue: input.venue,
      });
      if (normalized.length) {
        const withDetails = await this.enrichDetails(
          normalized,
          hotels.records,
          hotels.correlationId,
          hotels.token,
        );
        this.logger.log(
          `RouteStack hotels ok query="${input.query}" destination=${destination.id} (${destination.fullName ?? destination.type}) count=${withDetails.length}`,
        );
        return rankRouteStackHotelsForStayPreference(
          withDetails,
          input.stayPreference,
        );
      }
    }

    return [];
  }

  private async searchHotelsWithPoll(
    body: Parameters<RouteStackHttpClient['searchHotels']>[0],
  ): Promise<{
    records: RouteStackHotelRecord[];
    currency?: string;
    correlationId?: string;
    token?: string;
  }> {
    let correlationId = body.correlationId;
    let token = body.token;
    let nextResultsKey = body.nextResultsKey;

    for (let attempt = 0; attempt < MAX_HOTEL_POLL_ATTEMPTS; attempt++) {
      const response = await this.client.searchHotels({
        ...body,
        ...(correlationId ? { correlationId } : {}),
        ...(token ? { token } : {}),
        ...(nextResultsKey ? { nextResultsKey } : {}),
      });
      const result = response.result;
      const records = Array.isArray(result?.result) ? result.result : [];
      correlationId = result?.correlationId ?? correlationId;
      token = result?.token ?? token;
      nextResultsKey = result?.nextResultsKey ?? nextResultsKey;

      if (records.length) {
        return { records, currency: result?.currency, correlationId, token };
      }

      // Only poll while the provider reports an in-progress first page.
      // Do not treat nextResultsKey alone as "still loading" (that is pagination).
      const status = (result?.status ?? '').toLowerCase();
      const stillLoading = status === 'inprogress' || status === 'in_progress';
      if (!stillLoading || attempt === MAX_HOTEL_POLL_ATTEMPTS - 1) {
        return { records, currency: result?.currency, correlationId, token };
      }

      await sleep(HOTEL_POLL_DELAY_MS);
    }

    return { records: [] };
  }

  /** Detail calls are best-effort: inventory remains usable if a supplier omits content. */
  private async enrichDetails(
    hotels: NormalizedHotelOption[],
    records: RouteStackHotelRecord[],
    correlationId?: string,
    token?: string,
  ): Promise<NormalizedHotelOption[]> {
    if (!correlationId || !token) return hotels;

    const sourceById = new Map(
      records
        .filter((record) => record.id?.trim())
        .map((record) => [record.id!.trim(), record]),
    );
    const detailCandidates = hotels.slice(0, 6);
    const details = await Promise.all(
      detailCandidates.map(async (hotel) => {
        const source = sourceById.get(hotel.id);
        if (!source?.id) return hotel;
        try {
          const response = await this.client.getHotelDetails({
            hotelId: source.id,
            contentType: 'ALL',
            correlationId,
            token,
          });
          return enrichRouteStackHotelFromDetails(hotel, response);
        } catch (error) {
          this.logger.debug(
            `RouteStack hotel details skipped hotel=${hotel.id}: ${error instanceof Error ? error.message : String(error)}`,
          );
          return hotel;
        }
      }),
    );
    const enrichedById = new Map(details.map((hotel) => [hotel.id, hotel]));
    return hotels.map((hotel) => enrichedById.get(hotel.id) ?? hotel);
  }
}

function rankDestinationCandidates(
  destinations: RouteStackDestinationItem[],
  venue?: { lat: number; lng: number },
): RouteStackDestinationItem[] {
  const primary = pickRouteStackDestination(destinations, venue);
  if (!primary) return [];
  const cityRest = destinations.filter(
    (d) =>
      d.id !== primary.id &&
      CITY_DESTINATION_TYPES.has((d.type ?? '').trim().toLowerCase()),
  );
  return [primary, ...cityRest];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
