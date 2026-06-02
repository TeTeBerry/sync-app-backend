import { createHash } from 'crypto';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
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
    budgetTier: dto.budgetTier,
    selfDrive: Boolean(dto.selfDrive),
    accommodationNights,
  };
}

export function buildTravelGuideGenerationCacheKey(
  params: TravelGuideGenerationCacheParams,
): string {
  const canonical = JSON.stringify(params);
  return createHash('sha256').update(canonical).digest('hex');
}
