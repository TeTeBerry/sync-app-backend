import { createHash } from 'node:crypto';
import type { NormalizedHotelOption } from '../../types/normalized-hotel-option';
import type {
  RouteStackDestinationItem,
  RouteStackHotelRecord,
  RouteStackRoomOccupancy,
} from './routestack.types';

const CITY_TYPE_PRIORITY = new Set([
  'city',
  'multi-city',
  'multicity',
  'region',
]);

/**
 * Festival / small-town catalog names → nearby cities that actually have
 * RouteStack hotel inventory. Searching "Boom" returns success:false code 204.
 */
const HOTEL_HUB_BY_TOWN: Record<string, string[]> = {
  boom: ['Antwerp', 'Brussels'],
  布姆: ['Antwerp', 'Brussels'],
  pattaya: ['Pattaya', 'Bangkok'],
  芭提雅: ['Pattaya', 'Bangkok'],
};

/**
 * Country / area labels → English hotel-search hubs (fallback only).
 * Short ASCII keys (uk/uae/usa) must match as whole tokens — never via includes().
 */
const HOTEL_HUB_BY_AREA: Record<string, string[]> = {
  比利时: ['Antwerp', 'Brussels'],
  belgium: ['Antwerp', 'Brussels'],
  荷兰: ['Amsterdam'],
  netherlands: ['Amsterdam'],
  泰国: ['Bangkok', 'Pattaya', 'Phuket'],
  thailand: ['Bangkok', 'Pattaya', 'Phuket'],
  韩国: ['Seoul'],
  korea: ['Seoul'],
  'south korea': ['Seoul'],
  日本: ['Tokyo', 'Osaka'],
  japan: ['Tokyo', 'Osaka'],
  英国: ['London'],
  'united kingdom': ['London'],
  uk: ['London'],
  阿联酋: ['Dubai'],
  uae: ['Dubai'],
  美国: ['Las Vegas', 'Los Angeles', 'New York', 'Orlando'],
  usa: ['Las Vegas', 'Los Angeles', 'New York', 'Orlando'],
  'united states': ['Las Vegas', 'Los Angeles', 'New York', 'Orlando'],
};

/** Short keys that must not substring-match (e.g. "uk" inside "ukraine"). */
const AREA_EXACT_TOKEN_KEYS = new Set(['uk', 'uae', 'usa']);

/** Common catalog Chinese city → English for RouteStack SearchDestinations. */
const CITY_ZH_TO_EN: Record<string, string> = {
  安特卫普: 'Antwerp',
  布鲁塞尔: 'Brussels',
  阿姆斯特丹: 'Amsterdam',
  伦敦: 'London',
  曼谷: 'Bangkok',
  普吉: 'Phuket',
  芭提雅: 'Pattaya',
  清迈: 'Chiang Mai',
  首尔: 'Seoul',
  仁川: 'Incheon',
  釜山: 'Busan',
  东京: 'Tokyo',
  大阪: 'Osaka',
  冲绳: 'Okinawa',
  迪拜: 'Dubai',
  布加勒斯特: 'Bucharest',
  萨格勒布: 'Zagreb',
  斯普利特: 'Split',
  香港: 'Hong Kong',
  澳门: 'Macau',
  台北: 'Taipei',
  拉斯维加斯: 'Las Vegas',
  洛杉矶: 'Los Angeles',
  纽约: 'New York',
  奥兰多: 'Orlando',
  利雅得: 'Riyadh',
  吉达: 'Jeddah',
};

const HAS_LATIN = /[A-Za-z]/;
const MOSTLY_CJK = /[\u4e00-\u9fff]/;

export function buildRouteStackDestinationQuery(input: {
  destinationCity: string;
  venueTitle?: string;
  activityArea?: string;
  activityLocation?: string;
  activityName?: string;
}): string {
  return buildRouteStackDestinationQueries(input)[0] ?? '';
}

/**
 * Ordered SearchDestinations queries.
 * 1) Town hubs for tiny festival towns (Boom → Antwerp) — only when the town itself is mapped
 * 2) Primary city / venue candidates (Phuket before Bangkok)
 * 3) Country/area hubs as last-resort fallbacks
 */
export function buildRouteStackDestinationQueries(input: {
  destinationCity: string;
  venueTitle?: string;
  activityArea?: string;
  activityLocation?: string;
  activityName?: string;
}): string[] {
  const primaryCandidates = [
    latinPrefer(input.destinationCity),
    translateKnownCity(input.destinationCity),
    latinPrefer(extractLatinCityFromLocation(input.activityLocation)),
    translateKnownCity(extractLeadingCity(input.activityLocation)),
    latinPrefer(input.venueTitle),
    translateKnownCity(input.activityArea),
    latinPrefer(input.activityName),
    input.destinationCity.trim(),
    input.activityArea?.trim() ?? '',
    input.venueTitle?.trim() ?? '',
    input.activityLocation?.trim() ?? '',
  ].filter(Boolean);

  const primary = primaryCandidates[0] ?? '';
  const townHubs = [
    ...lookupHotelHubs(input.destinationCity),
    ...lookupHotelHubs(primary),
    ...lookupHotelHubs(extractLeadingCity(input.activityLocation)),
  ];
  const areaHubs = [
    ...lookupAreaHotelHubs(input.activityArea),
    ...lookupAreaHotelHubs(input.activityLocation),
  ];

  // Town hubs first (Boom has no inventory). Area hubs last so Phuket/Osaka
  // are not shadowed by Bangkok/Tokyo country defaults.
  return uniqueNonEmpty([...townHubs, ...primaryCandidates, ...areaHubs]);
}

function lookupHotelHubs(value?: string): string[] {
  const key = value?.trim().toLowerCase() ?? '';
  if (!key) return [];
  if (HOTEL_HUB_BY_TOWN[key]) return [...HOTEL_HUB_BY_TOWN[key]!];
  for (const [town, hubs] of Object.entries(HOTEL_HUB_BY_TOWN)) {
    if (key.includes(town)) return [...hubs];
  }
  return [];
}

function lookupAreaHotelHubs(value?: string): string[] {
  const raw = value?.trim() ?? '';
  if (!raw) return [];
  const lower = raw.toLowerCase();
  if (HOTEL_HUB_BY_AREA[raw]) return [...HOTEL_HUB_BY_AREA[raw]!];
  if (HOTEL_HUB_BY_AREA[lower]) return [...HOTEL_HUB_BY_AREA[lower]!];

  for (const [area, hubs] of Object.entries(HOTEL_HUB_BY_AREA)) {
    if (AREA_EXACT_TOKEN_KEYS.has(area)) {
      // Whole-token only: "uk" must not match "ukraine".
      if (hasWholeToken(lower, area)) return [...hubs];
      continue;
    }
    if (raw.includes(area) || lower.includes(area)) return [...hubs];
  }
  return [];
}

function hasWholeToken(haystack: string, token: string): boolean {
  if (!token) return false;
  const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?:^|[^a-z0-9])${escaped}(?:$|[^a-z0-9])`, 'i').test(
    haystack,
  );
}

function uniqueNonEmpty(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}

function latinPrefer(value?: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed || !HAS_LATIN.test(trimmed)) return '';
  // Skip pure CJK-dominant strings that happen to include a Latin code.
  if (MOSTLY_CJK.test(trimmed) && !/^[A-Za-z]/.test(trimmed)) return '';
  return trimmed;
}

function translateKnownCity(value?: string): string {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return '';
  if (CITY_ZH_TO_EN[trimmed]) return CITY_ZH_TO_EN[trimmed]!;
  for (const [zh, en] of Object.entries(CITY_ZH_TO_EN)) {
    if (trimmed.includes(zh)) return en;
  }
  return '';
}

function extractLatinCityFromLocation(location?: string): string {
  const loc = location?.trim() ?? '';
  if (!loc) return '';
  const parts = loc
    .split(/[·,，]/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    if (HAS_LATIN.test(part) && !MOSTLY_CJK.test(part)) return part;
  }
  return '';
}

function extractLeadingCity(location?: string): string {
  const loc = location?.trim() ?? '';
  if (!loc) return '';
  const parts = loc
    .split(/[·,，]/)
    .map((part) => part.trim())
    .filter(Boolean);
  return parts[0] ?? loc;
}

export function pickRouteStackDestination(
  destinations: RouteStackDestinationItem[],
  venue?: { lat: number; lng: number },
): RouteStackDestinationItem | null {
  const usable = destinations.filter((d) => d.id?.trim());
  if (!usable.length) return null;

  const withCoords = usable.map((d) => ({
    item: d,
    lat: asFiniteNumber(d.lat ?? d.coordinates?.lat),
    long: asFiniteNumber(d.long ?? d.coordinates?.long),
  }));

  const cityHits = withCoords.filter((d) =>
    CITY_TYPE_PRIORITY.has((d.item.type ?? '').trim().toLowerCase()),
  );
  const pool = cityHits.length ? cityHits : withCoords;

  if (venue && Number.isFinite(venue.lat) && Number.isFinite(venue.lng)) {
    const ranked = [...pool].sort((a, b) => {
      const aDist =
        a.lat != null && a.long != null
          ? haversineKm(venue.lat, venue.lng, a.lat, a.long)
          : Number.POSITIVE_INFINITY;
      const bDist =
        b.lat != null && b.long != null
          ? haversineKm(venue.lat, venue.lng, b.lat, b.long)
          : Number.POSITIVE_INFINITY;
      return aDist - bDist;
    });
    return ranked[0]?.item ?? null;
  }

  return pool[0]?.item ?? null;
}

export function destinationCoords(destination: RouteStackDestinationItem): {
  lat: number;
  long: number;
} | null {
  const lat = asFiniteNumber(destination.lat ?? destination.coordinates?.lat);
  const long = asFiniteNumber(
    destination.long ?? destination.coordinates?.long,
  );
  if (lat == null || long == null) return null;
  return { lat, long };
}

export function buildRouteStackRooms(
  headcount: number,
): RouteStackRoomOccupancy[] {
  const guests = Math.max(1, Math.floor(headcount) || 1);
  const roomCount = Math.max(1, Math.ceil(guests / 2));
  const rooms: RouteStackRoomOccupancy[] = [];
  let remaining = guests;
  for (let i = 0; i < roomCount; i++) {
    const adults = Math.min(2, remaining);
    rooms.push({ adults: Math.max(1, adults), children: 0, childAges: [] });
    remaining -= adults;
  }
  return rooms;
}

export function normalizeRouteStackHotels(
  hotels: RouteStackHotelRecord[],
  input: {
    accommodationNights: number;
    currency?: string;
    venue?: { lat: number; lng: number };
  },
): NormalizedHotelOption[] {
  const nights = Math.max(1, input.accommodationNights);
  const currency = (input.currency?.trim().toUpperCase() || 'USD') as
    | 'USD'
    | 'CNY';

  return hotels
    .filter((h) => h.name?.trim())
    .map((hotel, index) => {
      // RouteStack `ourprice` is the stay-total for the checkIn→checkOut window
      // (scales with nights). Convert to nightly for Raven scoring / display.
      const stayTotal = asFiniteNumber(hotel.ourprice ?? hotel.baseprice);
      const nightly =
        stayTotal != null && stayTotal > 0
          ? Math.round((stayTotal / nights) * 100) / 100
          : null;
      const lat = asFiniteNumber(hotel.lat ?? hotel.latitude);
      const lng = asFiniteNumber(hotel.long ?? hotel.longitude);
      const address = formatHotelAddress(hotel);
      const distanceKm = resolveDistanceKm(hotel, input.venue, lat, lng);
      const reviewScore = asFiniteNumber(hotel.reviews?.rating);
      const starRating = asFiniteNumber(hotel.starRating);
      const id =
        hotel.id?.trim() ||
        `routestack_${createHash('sha1')
          .update(`${hotel.name}|${stayTotal ?? ''}|${index}`)
          .digest('hex')
          .slice(0, 12)}`;

      return {
        id,
        provider: 'routestack',
        name: hotel.name!.trim(),
        address,
        latitude: lat ?? undefined,
        longitude: lng ?? undefined,
        starRating: starRating ?? undefined,
        reviewScore: reviewScore ?? undefined,
        distanceToFestivalKm: distanceKm,
        price:
          nightly != null && stayTotal != null
            ? {
                nightlyAmount: nightly,
                totalAmount: stayTotal,
                currency: currency === 'CNY' ? 'CNY' : 'USD',
              }
            : undefined,
        searchedAt: new Date().toISOString(),
        supplierTrust: 0.75,
      } satisfies NormalizedHotelOption;
    });
}

function formatHotelAddress(hotel: RouteStackHotelRecord): string | undefined {
  const line1 = hotel.contact?.address?.line1?.trim();
  const city = hotel.contact?.address?.city?.name?.trim();
  const country = hotel.contact?.address?.country?.name?.trim();
  const parts = [line1, city, country].filter(Boolean);
  return parts.length ? parts.join(', ') : undefined;
}

function resolveDistanceKm(
  hotel: RouteStackHotelRecord,
  venue: { lat: number; lng: number } | undefined,
  lat: number | null,
  lng: number | null,
): number | undefined {
  if (venue && lat != null && lng != null) {
    return Math.round(haversineKm(venue.lat, venue.lng, lat, lng) * 10) / 10;
  }
  const raw = asFiniteNumber(hotel.distance);
  if (raw == null || raw < 0) return undefined;
  const km = raw > 200 ? raw / 1000 : raw;
  return Math.round(km * 10) / 10;
}

function asFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const r = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * r * Math.asin(Math.sqrt(a));
}
