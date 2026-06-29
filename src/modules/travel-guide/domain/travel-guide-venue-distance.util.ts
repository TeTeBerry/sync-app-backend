import { haversineDistanceM } from '../map/travel-guide-intercity.util';

export function formatVenueDistanceLabel(distanceM: number): string {
  if (distanceM < 1000) return `${Math.round(distanceM)}m`;
  return `${(distanceM / 1000).toFixed(1)}km`;
}

export function resolveHotelVenueDistanceM(
  hotel: {
    lat?: number;
    lng?: number;
    distanceM?: number;
  },
  venue?: { lat: number; lng: number },
): number | undefined {
  if (
    venue &&
    typeof hotel.lat === 'number' &&
    typeof hotel.lng === 'number' &&
    Number.isFinite(hotel.lat) &&
    Number.isFinite(hotel.lng)
  ) {
    return Math.round(
      haversineDistanceM(
        { lat: venue.lat, lng: venue.lng },
        { lat: hotel.lat, lng: hotel.lng },
      ),
    );
  }
  if (
    typeof hotel.distanceM === 'number' &&
    hotel.distanceM > 0 &&
    Number.isFinite(hotel.distanceM)
  ) {
    return Math.round(hotel.distanceM);
  }
  return undefined;
}
