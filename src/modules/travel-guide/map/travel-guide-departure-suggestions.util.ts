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
  options?: { eventRegion?: string; departureCity?: string },
): string | undefined {
  const anchor = findDepartureCityAnchor(keyword);
  if (anchor) return anchor;
  const picked = options?.departureCity?.trim();
  if (picked) return normalizeDepartureCityLabel(picked);
  return options?.eventRegion?.trim() || undefined;
}

/** Strip admin suffix so geocoder region matches local city catalog (e.g. 上海市 → 上海). */
export function normalizeDepartureCityLabel(city: string): string {
  const trimmed = city.trim();
  if (!trimmed) return trimmed;
  const stripped = trimmed
    .replace(/(特别行政区|自治州|地区|盟)$/, '')
    .replace(/[省市]$/, '');
  return stripped || trimmed;
}

/**
 * Geocoder address + region for submitted departure text.
 * Never use company/POI name as `region` (Tencent returns 参数错误).
 */
export function resolveDepartureGeocodeTargets(
  departureText: string,
  eventRegion?: string,
  departureCity?: string,
): { address: string; region?: string } {
  const q = departureText.trim();
  if (!q) return { address: '' };

  const anchor = findDepartureCityAnchor(q);
  const event = eventRegion?.trim();
  const pickedCity = departureCity?.trim()
    ? normalizeDepartureCityLabel(departureCity)
    : undefined;

  if (anchor && anchor === q) {
    return { address: anchor, region: anchor };
  }

  if (anchor) {
    return { address: q, region: anchor };
  }

  if (pickedCity) {
    return { address: q, region: pickedCity };
  }

  const region = resolveSuggestionRegion(q, { eventRegion: event });
  return { address: q, region: region ?? (event || undefined) };
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
