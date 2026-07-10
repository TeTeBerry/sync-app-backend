import { createHash } from 'node:crypto';
import type { TravelGuideFlightOffer } from '@sync/travel-guide-contracts';
import type { FlightQuoteSnapshot } from '../ports/travel-quote.types';
import type { NormalizedFlightOption } from '../types/normalized-flight-option';

function parseStops(stopsLabel?: string): number {
  const label = stopsLabel?.trim() ?? '';
  if (!label || /直飞|non[\s-]?stop/i.test(label)) return 0;
  const match = label.match(/(\d+)/);
  return match ? Number(match[1]) : 1;
}

function parseDurationMinutes(
  departureAt?: string,
  arrivalAt?: string,
): number {
  if (!departureAt || !arrivalAt) return 0;
  const dep = Date.parse(departureAt);
  const arr = Date.parse(arrivalAt);
  if (!Number.isFinite(dep) || !Number.isFinite(arr) || arr <= dep) return 0;
  return Math.round((arr - dep) / 60_000);
}

function offerId(
  offer: TravelGuideFlightOffer,
  index: number,
  from: string,
  to: string,
): string {
  const raw = [
    from,
    to,
    offer.outbound.depTime ?? '',
    offer.outbound.arrTime ?? '',
    offer.pricePerAdult,
    offer.cabinLabel ?? '',
    index,
  ].join('|');
  return `flight_${createHash('sha1').update(raw).digest('hex').slice(0, 12)}`;
}

function airlinesFromOffer(offer: TravelGuideFlightOffer): string[] {
  const numbers = [
    ...(offer.outbound.flightNumbers ?? []),
    ...(offer.return?.flightNumbers ?? []),
  ];
  const codes = numbers
    .map((n) => n.trim().match(/^[A-Z0-9]{2}/)?.[0])
    .filter((code): code is string => Boolean(code));
  return [...new Set(codes)];
}

export function normalizeFlightOptionsFromQuote(
  quote: FlightQuoteSnapshot | null | undefined,
): NormalizedFlightOption[] {
  if (!quote) return [];

  const offers = quote.flightOffers ?? [];
  if (offers.length) {
    return offers.map((offer, index) => {
      const departureAt =
        offer.outbound.depTime ?? `${quote.outboundDate}T00:00:00`;
      const arrivalAt =
        offer.outbound.arrTime ?? `${quote.outboundDate}T00:00:00`;
      return {
        id: offerId(offer, index, quote.fromCityCode, quote.toCityCode),
        provider: quote.source,
        originAirportCode: quote.fromCityCode,
        destinationAirportCode: quote.toCityCode,
        departureAt,
        arrivalAt,
        durationMinutes: parseDurationMinutes(departureAt, arrivalAt),
        stops: parseStops(offer.outbound.stopsLabel),
        airlines: airlinesFromOffer(offer),
        price: {
          amount: offer.pricePerAdult,
          currency: offer.currency,
        },
        searchedAt: quote.fetchedAt,
        cabinLabel: offer.cabinLabel ?? quote.cabinLabel,
        returnDepartureAt: offer.return?.depTime,
        returnArrivalAt: offer.return?.arrTime,
        sampleLine: quote.sampleLines?.[index],
      };
    });
  }

  if (quote.minPricePerAdult <= 0) return [];

  return [
    {
      id: `flight_summary_${quote.fromCityCode}_${quote.toCityCode}_${quote.outboundDate}`,
      provider: quote.source,
      originAirportCode: quote.fromCityCode,
      destinationAirportCode: quote.toCityCode,
      departureAt: `${quote.outboundDate}T00:00:00`,
      arrivalAt: `${quote.outboundDate}T00:00:00`,
      durationMinutes: 0,
      stops: 0,
      airlines: [],
      price: {
        amount: quote.minPricePerAdult,
        currency: quote.currency,
      },
      searchedAt: quote.fetchedAt,
      cabinLabel: quote.cabinLabel,
      sampleLine: quote.sampleLines?.[0],
    },
  ];
}

export function dedupeNormalizedFlights(
  flights: NormalizedFlightOption[],
): NormalizedFlightOption[] {
  const seen = new Set<string>();
  const result: NormalizedFlightOption[] = [];
  for (const flight of flights) {
    const key = [
      flight.originAirportCode,
      flight.destinationAirportCode,
      flight.departureAt,
      flight.arrivalAt,
      flight.price.amount,
      flight.cabinLabel ?? '',
    ].join('|');
    if (seen.has(key)) continue;
    seen.add(key);
    if (flight.price.amount <= 0) continue;
    result.push(flight);
  }
  return result;
}
