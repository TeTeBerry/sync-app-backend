/** Catalog activity type — extensible for indoor EDM venues later. */
export const ACTIVITY_TYPES = ['festival', 'indoor'] as const;

export type ActivityType = (typeof ACTIVITY_TYPES)[number];

export const ACTIVITY_TYPE_LABELS: Record<ActivityType, string> = {
  festival: '电音节',
  indoor: '室内电音',
};

export function resolveActivityType(value?: string | null): ActivityType {
  const normalized = (value ?? '').trim().toLowerCase();
  if (normalized === 'indoor' || normalized === '室内电音') return 'indoor';
  return 'festival';
}

export function getActivityTypeLabel(value?: string | null): string {
  return ACTIVITY_TYPE_LABELS[resolveActivityType(value)];
}
