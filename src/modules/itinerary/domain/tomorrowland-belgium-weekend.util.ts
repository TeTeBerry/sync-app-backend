export const TOMORROWLAND_BELGIUM_ACTIVITY_LEGACY_ID = 7;

export const TOMORROWLAND_BELGIUM_WEEKENDS = {
  w1: ['jul17', 'jul18', 'jul19'],
  w2: ['jul24', 'jul25', 'jul26'],
} as const;

export type TomorrowlandBelgiumWeekend =
  keyof typeof TOMORROWLAND_BELGIUM_WEEKENDS;

export function isTomorrowlandBelgiumWeekend(
  value?: string,
): value is TomorrowlandBelgiumWeekend {
  return value === 'w1' || value === 'w2';
}

export function dateKeysForTomorrowlandBelgiumWeekend(
  activityLegacyId: number,
  weekend?: TomorrowlandBelgiumWeekend,
): readonly string[] | undefined {
  if (
    activityLegacyId !== TOMORROWLAND_BELGIUM_ACTIVITY_LEGACY_ID ||
    !weekend
  ) {
    return undefined;
  }
  return TOMORROWLAND_BELGIUM_WEEKENDS[weekend];
}
