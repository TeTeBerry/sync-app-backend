export type TravelGuideLocale = 'zh' | 'en';

export function resolveTravelGuideLocale(
  value?: string | null,
): TravelGuideLocale {
  return value === 'en' ? 'en' : 'zh';
}
