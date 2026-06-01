import { TRAVEL_GUIDE_DEPARTURE_CITIES } from './travel-guide-departure-cities.data';

export function filterTravelGuideCitySuggestions(
  query: string,
  limit = 10,
): string[] {
  const q = query.trim();
  if (!q) {
    return TRAVEL_GUIDE_DEPARTURE_CITIES.slice(0, Math.min(limit, 8));
  }

  const matched = TRAVEL_GUIDE_DEPARTURE_CITIES.filter((city) =>
    city.includes(q),
  );
  return [...matched].slice(0, limit);
}
