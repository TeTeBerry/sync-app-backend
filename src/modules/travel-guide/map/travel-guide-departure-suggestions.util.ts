import { TRAVEL_GUIDE_DEPARTURE_CITIES } from './travel-guide-departure-cities.data';
import { filterTravelGuideCitySuggestions } from './travel-guide-city-suggestions.util';

const DEPARTURE_CITIES: readonly string[] = TRAVEL_GUIDE_DEPARTURE_CITIES;

export type PlaceSuggestionRow = {
  title: string;
  address: string;
  city?: string;
};

export function findDepartureCityAnchor(query: string): string | null {
  const q = query.trim();
  if (!q) return null;

  const exact = DEPARTURE_CITIES.find((c) => c === q);
  if (exact) return exact;

  for (const city of DEPARTURE_CITIES) {
    if (q.startsWith(city)) return city;
  }

  const prefixMatches = DEPARTURE_CITIES.filter((c) => c.startsWith(q));
  if (prefixMatches.length === 1) return prefixMatches[0] ?? null;

  return null;
}

export function resolveSuggestionRegion(
  keyword: string,
  eventRegion?: string,
): string | undefined {
  const anchor = findDepartureCityAnchor(keyword);
  if (anchor) return anchor;
  return eventRegion?.trim() || undefined;
}

export function filterRemoteSuggestionsByAnchor(
  keyword: string,
  items: PlaceSuggestionRow[],
): PlaceSuggestionRow[] {
  const anchor = findDepartureCityAnchor(keyword);
  if (!anchor) return items;
  return items.filter((item) => {
    const blob = `${item.title}${item.address}${item.city ?? ''}`;
    return blob.includes(anchor);
  });
}

export function mergePlaceSuggestions(
  keyword: string,
  remote: PlaceSuggestionRow[],
): PlaceSuggestionRow[] {
  const merged: PlaceSuggestionRow[] = [];
  const seen = new Set<string>();

  for (const title of filterTravelGuideCitySuggestions(keyword, 10)) {
    if (seen.has(title)) continue;
    seen.add(title);
    merged.push({ title, address: title, city: title });
  }

  for (const item of filterRemoteSuggestionsByAnchor(keyword, remote)) {
    const key = item.title.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    merged.push(item);
  }

  return merged.slice(0, 10);
}
