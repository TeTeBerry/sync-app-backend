import type { LlmTravelGuidePayload } from './travel-guide-llm.types';
import type { TravelGuideLocale } from './travel-guide-locale';

const CJK_CHAR = /[\u4e00-\u9fff]/g;

/**
 * Collect user-facing prose fields for locale language checks.
 * Excludes merchant/venue `name` fields (proper nouns may stay Chinese).
 */
export function collectTravelGuideProseSamples(
  payload: LlmTravelGuidePayload,
): string[] {
  const samples: string[] = [];
  samples.push(...(payload.transportLines ?? []));
  samples.push(...(payload.tipItems ?? []));
  samples.push(...(payload.parkingLines ?? []));
  samples.push(...(payload.documentItems ?? []));

  for (const hotel of payload.hotels ?? []) {
    if (hotel.note) samples.push(hotel.note);
    if (hotel.reason) samples.push(hotel.reason);
    if (hotel.bookingHint) samples.push(hotel.bookingHint);
  }
  for (const scheme of payload.accommodationSchemes ?? []) {
    if (scheme.label) samples.push(scheme.label);
    if (scheme.note) samples.push(scheme.note);
    if (scheme.reason) samples.push(scheme.reason);
    if (scheme.bookingHint) samples.push(scheme.bookingHint);
  }
  for (const spot of payload.nightlifeSpots ?? []) {
    if (spot.note) samples.push(spot.note);
    if (spot.reason) samples.push(spot.reason);
  }
  for (const channel of payload.ticketChannels ?? []) {
    if (channel.note) samples.push(channel.note);
  }
  for (const option of payload.venueTransportOptions ?? []) {
    if (option.label) samples.push(option.label);
    samples.push(...(option.lines ?? []));
  }
  for (const item of payload.budgetItems ?? []) {
    if (item.label) samples.push(item.label);
    if (item.range) samples.push(item.range);
    if (item.note) samples.push(item.note);
  }
  if (payload.essentials) {
    samples.push(...(payload.essentials.network ?? []));
    samples.push(...(payload.essentials.payment ?? []));
    samples.push(...(payload.essentials.apps ?? []));
  }
  return samples.map((s) => s.trim()).filter(Boolean);
}

/** True when CJK characters are a small share of letter-like characters. */
export function isMostlyEnglishProse(
  texts: string[],
  maxCjkRatio = 0.18,
): boolean {
  const joined = texts.join('\n').trim();
  if (!joined) return true;

  const cjkCount = (joined.match(CJK_CHAR) ?? []).length;
  if (cjkCount === 0) return true;

  const latinCount = (joined.match(/[A-Za-z]/g) ?? []).length;
  // Mostly CJK with little/no Latin → fail EN check.
  if (latinCount === 0) return false;

  return cjkCount / (cjkCount + latinCount) <= maxCjkRatio;
}

/**
 * EN plans must not ship Chinese-dominated polish prose.
 * ZH plans are not constrained here (catalog may mix Latin proper nouns).
 */
export function passesTravelGuideLocaleLanguage(
  payload: LlmTravelGuidePayload,
  locale: TravelGuideLocale,
): boolean {
  if (locale !== 'en') return true;
  return isMostlyEnglishProse(collectTravelGuideProseSamples(payload));
}
