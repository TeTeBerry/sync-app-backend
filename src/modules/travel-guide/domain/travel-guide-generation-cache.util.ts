import { createHash } from 'crypto';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { resolveTravelGuideBudgetTier } from './parse-activity-days.util';
import { normalizeDepartureCityLabel } from '../map/travel-guide-departure-suggestions.util';

export type TravelGuideGenerationCacheParams = {
  activityLegacyId: number;
  departure: string;
  departureCity: string;
  headcount: number;
  budgetTier: GenerateTravelGuideDto['budgetTier'];
  selfDrive: boolean;
  accommodationNights: number;
};

export function normalizeTravelGuideGenerationParams(
  activityLegacyId: number,
  dto: GenerateTravelGuideDto,
  accommodationNights: number,
): TravelGuideGenerationCacheParams {
  const departure = dto.departure.trim().replace(/\s+/g, ' ');
  const departureCity = dto.departureCity?.trim()
    ? (normalizeDepartureCityLabel(dto.departureCity.trim()) ??
      dto.departureCity.trim())
    : '';

  return {
    activityLegacyId,
    departure,
    departureCity,
    headcount: dto.headcount,
    budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    selfDrive: Boolean(dto.selfDrive),
    accommodationNights,
  };
}

/** Bump when map POI / venue resolution or overseas ticket channel logic changes. */
const TRAVEL_GUIDE_MAP_DATA_VERSION = 3;

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
 * - exact: activityLegacyId, budgetTier, selfDrive
 * - departure: exact string match (already normalized via normalizeDepartureCityLabel)
 * - headcount: |a - b| <= 2
 * - accommodationNights: |a - b| <= 1
 */
export function isFuzzyTravelGuideParamsMatch(
  exact: TravelGuideGenerationCacheParams,
  candidate: TravelGuideGenerationCacheParams,
): boolean {
  if (exact.activityLegacyId !== candidate.activityLegacyId) return false;
  if (exact.budgetTier !== candidate.budgetTier) return false;
  if (exact.selfDrive !== candidate.selfDrive) return false;
  if (exact.departure !== candidate.departure) return false;
  if (exact.departureCity !== candidate.departureCity) return false;
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
