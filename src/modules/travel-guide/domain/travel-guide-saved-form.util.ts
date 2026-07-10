import { BadRequestException } from '@nestjs/common';
import type { AiGuidePlanFormValues } from '@sync/travel-guide-contracts';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';

export function buildDtoFromSavedForm(
  form: AiGuidePlanFormValues | Record<string, unknown>,
  budgetTier?: TravelGuideBudgetTier,
): GenerateTravelGuideDto {
  const departure = String(form.departure ?? '').trim();
  const headcount = Number(form.headcount);
  const accommodationNights = Number(form.accommodationNights);
  const resolvedBudgetTier =
    budgetTier ??
    (typeof form.budgetTier === 'string'
      ? (form.budgetTier as TravelGuideBudgetTier)
      : undefined);

  if (!departure) {
    throw new BadRequestException('攻略表单缺少出发地');
  }
  if (!Number.isFinite(headcount) || headcount <= 0) {
    throw new BadRequestException('攻略表单人数无效');
  }
  if (!Number.isFinite(accommodationNights) || accommodationNights < 0) {
    throw new BadRequestException('攻略表单住宿晚数无效');
  }

  return {
    departure,
    departureCity:
      typeof form.departureCity === 'string' && form.departureCity.trim()
        ? form.departureCity.trim()
        : undefined,
    headcount,
    ...(resolvedBudgetTier ? { budgetTier: resolvedBudgetTier } : {}),
    selfDrive: Boolean(form.selfDrive),
    accommodationNights,
    ...(typeof form.locale === 'string' &&
    (form.locale === 'zh' || form.locale === 'en')
      ? { locale: form.locale }
      : {}),
  };
}
