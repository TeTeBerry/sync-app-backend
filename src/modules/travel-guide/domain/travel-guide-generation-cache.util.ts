import { createHash } from 'crypto';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { resolveTravelGuideBudgetTier } from './parse-activity-days.util';
import {
  findDepartureCityAnchor,
  normalizeDepartureCityLabel,
} from '../map/travel-guide-departure-suggestions.util';
import {
  resolveTravelGuideLocale,
  type TravelGuideLocale,
} from './travel-guide-locale';
import type { TravelGuideStayPreference } from '@sync/travel-guide-contracts';

export type TravelGuideGenerationCacheParams = {
  activityLegacyId: number;
  departure: string;
  departureCity: string;
  headcount: number;
  budgetTier: GenerateTravelGuideDto['budgetTier'];
  selfDrive: boolean;
  accommodationNights: number;
  stayPreference: TravelGuideStayPreference;
  note: string;
  locale: TravelGuideLocale;
};

export function normalizeTravelGuideGenerationParams(
  activityLegacyId: number,
  dto: GenerateTravelGuideDto,
  accommodationNights: number,
): TravelGuideGenerationCacheParams {
  const departure = dto.departure.trim().replace(/\s+/g, ' ');
  const departureCity = reconcileDepartureCityForCache(
    departure,
    dto.departureCity?.trim(),
  );

  return {
    activityLegacyId,
    departure,
    departureCity,
    headcount: dto.headcount,
    budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    selfDrive: Boolean(dto.selfDrive),
    accommodationNights,
    stayPreference: dto.stayPreference ?? 'festival',
    note: dto.note?.trim().replace(/\s+/g, ' ') ?? '',
    locale: resolveTravelGuideLocale(dto.locale),
  };
}

/** Bump when map POI / venue resolution, overseas ticket channel, locale copy,
 * EN USD display, EN RouteStack hotel provider, hotel-hub fallback, ourprice
 * stay-total normalization, Hunyuan locale language prompts, EN prose language
 * guard, bilingual ticket-channel catalog, per-activity flight airport
 * destinations, RollingGo city/airport endpoint, or cached quote-budget
 * recalculation changes. */
export const TRAVEL_GUIDE_MAP_DATA_VERSION = 20;

/**
 * Normalize params for fuzzy matching.
 * - headcount: bucketed to nearest 5 (±2 tolerance when matching)
 * - accommodationNights: allow ±1
 * - departure / departureCity: exact match (already normalized)
 */
export function normalizeFuzzyTravelGuideParams(
  params: TravelGuideGenerationCacheParams,
): TravelGuideGenerationCacheParams {
  return {
    ...params,
    /** bucket headcount to nearest 5 for fuzzy grouping */
    headcount: Math.max(1, Math.round(params.headcount / 5) * 5),
  };
}

/**
 * Check if two cache param sets are "fuzzy" equivalent.
 * - exact: activityLegacyId, budgetTier, selfDrive, locale
 * - departure: exact string match (already normalized via normalizeDepartureCityLabel)
 * - headcount: |a - b| <= 2
 * - accommodationNights: |a - b| <= 1
 * - mapDataVersion: must match current builder version (stored on save)
 */
export function isFuzzyTravelGuideParamsMatch(
  exact: TravelGuideGenerationCacheParams,
  candidate: TravelGuideGenerationCacheParams & {
    mapDataVersion?: number;
  },
): boolean {
  if (exact.activityLegacyId !== candidate.activityLegacyId) return false;
  if (exact.budgetTier !== candidate.budgetTier) return false;
  if (exact.selfDrive !== candidate.selfDrive) return false;
  if (exact.locale !== candidate.locale) return false;
  if (exact.departure !== candidate.departure) return false;
  if (exact.departureCity !== candidate.departureCity) return false;
  if (exact.note !== candidate.note) return false;
  if (exact.stayPreference !== candidate.stayPreference) return false;
  if ((candidate.mapDataVersion ?? 0) !== TRAVEL_GUIDE_MAP_DATA_VERSION) {
    return false;
  }
  if (Math.abs(exact.headcount - candidate.headcount) > 2) return false;
  if (exact.accommodationNights === 0 || candidate.accommodationNights === 0) {
    return exact.accommodationNights === candidate.accommodationNights;
  }
  if (Math.abs(exact.accommodationNights - candidate.accommodationNights) > 1)
    return false;
  return true;
}

export function buildTravelGuideGenerationCacheKey(
  params: TravelGuideGenerationCacheParams,
): string {
  const canonical = JSON.stringify({
    ...params,
    mapDataVersion: TRAVEL_GUIDE_MAP_DATA_VERSION,
  });
  return createHash('sha256').update(canonical).digest('hex');
}

/** Keep departureCity aligned with departure text when user switches cities. */
export function reconcileDepartureCityForCache(
  departure: string,
  departureCity?: string,
): string {
  const anchor = findDepartureCityAnchor(departure);
  const picked = departureCity?.trim()
    ? normalizeDepartureCityLabel(departureCity.trim())
    : '';

  if (anchor) {
    if (!picked || picked === anchor || departure.startsWith(anchor)) {
      return anchor;
    }
  }

  return picked;
}
