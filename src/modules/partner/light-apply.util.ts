import type { PostBuddyPreviewDto } from './dto/post-buddy-preview.dto';

export type LightApplyFields = {
  departureCity: string;
  tripDays?: number;
  genderPref?: string;
};

const GENDER_PREFS = new Set(['女生优先', '男生优先', '不限']);

export function normalizeLightApplyInput(input?: {
  departureCity?: string;
  tripDays?: number;
  genderPref?: string;
}): LightApplyFields | undefined {
  const departureCity = input?.departureCity?.trim();
  if (!departureCity) return undefined;

  const tripDays = input?.tripDays;
  if (
    tripDays != null &&
    (!Number.isFinite(tripDays) || tripDays < 1 || tripDays > 14)
  ) {
    return undefined;
  }

  const genderPref = input?.genderPref?.trim();
  if (genderPref && !GENDER_PREFS.has(genderPref)) {
    return undefined;
  }

  return {
    departureCity,
    tripDays: tripDays != null ? Math.round(tripDays) : undefined,
    genderPref: genderPref || undefined,
  };
}

export function formatLightApplyBody(fields: LightApplyFields): string {
  const parts = [`从${fields.departureCity}出发`];
  if (fields.tripDays != null) {
    parts.push(`活动 ${fields.tripDays} 天`);
  }
  if (fields.genderPref && fields.genderPref !== '不限') {
    parts.push(fields.genderPref);
  }
  return parts.join('，');
}

export function buildLightApplyInitialMessage(
  fields: LightApplyFields,
  extraMessage?: string,
): string {
  const base = formatLightApplyBody(fields);
  const note = extraMessage?.trim();
  if (!note) return base;
  return `${base}；补充：${note}`;
}

export function lightApplyToBuddyPreview(
  fields: LightApplyFields,
): PostBuddyPreviewDto {
  return {
    body: formatLightApplyBody(fields),
    location: fields.departureCity,
    tags: ['#组队'],
  };
}

export function buddyPreviewFromApplicationRow(row?: {
  lightDepartureCity?: string;
  lightTripDays?: number;
  lightGenderPref?: string;
}): PostBuddyPreviewDto | undefined {
  const fields = normalizeLightApplyInput({
    departureCity: row?.lightDepartureCity,
    tripDays: row?.lightTripDays,
    genderPref: row?.lightGenderPref,
  });
  return fields ? lightApplyToBuddyPreview(fields) : undefined;
}
