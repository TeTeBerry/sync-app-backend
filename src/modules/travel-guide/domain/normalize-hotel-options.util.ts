import { createHash } from 'node:crypto';
import type {
  HotelQuoteSnapshot,
  RollingGoHotelRecommendation,
} from '../ports/travel-quote.types';
import type { NormalizedHotelOption } from '../types/normalized-hotel-option';

function hotelId(
  name: string,
  provider: string,
  nightly?: number,
  index = 0,
): string {
  const raw = `${provider}|${name}|${nightly ?? ''}|${index}`;
  return `hotel_${createHash('sha1').update(raw).digest('hex').slice(0, 12)}`;
}

export function normalizeHotelOptionsFromQuote(
  quote: HotelQuoteSnapshot | null | undefined,
  accommodationNights = 1,
): NormalizedHotelOption[] {
  if (!quote) return [];

  const recommendations = quote.recommendations ?? [];
  if (recommendations.length) {
    return recommendations.map((rec, index) =>
      recommendationToNormalized(rec, quote, accommodationNights, index),
    );
  }

  if (quote.minPricePerNight <= 0) return [];

  return [
    {
      id: hotelId('quote_summary', quote.source, quote.minPricePerNight),
      provider: quote.source,
      name: '参考酒店报价',
      price: {
        nightlyAmount: quote.minPricePerNight,
        totalAmount: quote.minPricePerNight * Math.max(1, accommodationNights),
        currency: quote.currency,
      },
      searchedAt: quote.fetchedAt,
    },
  ];
}

function recommendationToNormalized(
  rec: RollingGoHotelRecommendation,
  quote: HotelQuoteSnapshot,
  accommodationNights: number,
  index: number,
): NormalizedHotelOption {
  const nightly = rec.minPricePerNight ?? quote.minPricePerNight;
  return {
    id: hotelId(rec.name, quote.source, nightly, index),
    provider: quote.source,
    name: rec.name,
    address: rec.address,
    starRating: rec.starRating,
    distanceToFestivalKm:
      rec.distanceM != null
        ? Math.round((rec.distanceM / 1000) * 10) / 10
        : undefined,
    price: {
      nightlyAmount: nightly,
      totalAmount: nightly * Math.max(1, accommodationNights),
      currency: quote.currency,
    },
    bookingUrl: rec.bookingUrl,
    searchedAt: quote.fetchedAt,
  };
}

export function normalizeHotelOptionsFromMapPois(
  pois: Array<{
    id?: string;
    name: string;
    address?: string;
    lat?: number;
    lng?: number;
    distanceM?: number;
    rating?: number;
    avgPrice?: number;
  }>,
  accommodationNights: number,
  currency: 'CNY' | 'USD' = 'CNY',
): NormalizedHotelOption[] {
  return pois
    .filter((poi) => poi.name?.trim())
    .map((poi, index) => {
      const nightly =
        poi.avgPrice && poi.avgPrice > 0 ? poi.avgPrice : undefined;
      return {
        id: poi.id?.trim() || hotelId(poi.name, 'amap', nightly, index),
        provider: 'amap',
        name: poi.name.trim(),
        address: poi.address,
        latitude: poi.lat,
        longitude: poi.lng,
        reviewScore: poi.rating,
        distanceToFestivalKm:
          poi.distanceM != null
            ? Math.round((poi.distanceM / 1000) * 10) / 10
            : undefined,
        price: nightly
          ? {
              nightlyAmount: nightly,
              totalAmount: nightly * Math.max(1, accommodationNights),
              currency,
            }
          : undefined,
      };
    });
}

export function dedupeNormalizedHotels(
  hotels: NormalizedHotelOption[],
): NormalizedHotelOption[] {
  const seen = new Set<string>();
  const result: NormalizedHotelOption[] = [];
  for (const hotel of hotels) {
    const key = hotel.name.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(hotel);
  }
  return result;
}
