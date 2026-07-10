import type { TravelGuideLocale } from './travel-guide-locale';

/** Reference mid-market rate for display conversion only — not a live FX quote. */
export const CNY_PER_USD = 7.2;

export type TravelGuideCurrency = 'CNY' | 'USD';

export function displayCurrencyForLocale(
  locale: TravelGuideLocale,
): TravelGuideCurrency {
  return locale === 'en' ? 'USD' : 'CNY';
}

export function convertAmountToCurrency(
  amount: number,
  from: TravelGuideCurrency,
  to: TravelGuideCurrency,
): number {
  if (!Number.isFinite(amount)) return 0;
  if (from === to) return amount;
  if (from === 'CNY' && to === 'USD') return amount / CNY_PER_USD;
  return amount * CNY_PER_USD;
}

export function toDisplayAmount(
  amount: number,
  from: TravelGuideCurrency,
  locale: TravelGuideLocale,
): number {
  return convertAmountToCurrency(
    amount,
    from,
    displayCurrencyForLocale(locale),
  );
}

export function currencySymbol(currency: TravelGuideCurrency): string {
  return currency === 'USD' ? '$' : '¥';
}

export function formatTravelGuideMoney(
  amount: number,
  from: TravelGuideCurrency,
  locale: TravelGuideLocale,
  options?: { approx?: boolean; suffix?: string },
): string {
  const currency = displayCurrencyForLocale(locale);
  const rounded = Math.round(toDisplayAmount(amount, from, locale));
  const symbol = currencySymbol(currency);
  const approx = options?.approx !== false;
  const suffix = options?.suffix ?? '';
  if (locale === 'en') {
    return `${approx ? 'About ' : ''}${symbol}${rounded}${suffix}`;
  }
  return `${approx ? '约 ' : ''}${symbol}${rounded}${suffix}`;
}

export function formatTravelGuideMoneyRange(
  min: number,
  max: number,
  from: TravelGuideCurrency,
  locale: TravelGuideLocale,
  options?: { approx?: boolean; suffix?: string },
): string {
  const currency = displayCurrencyForLocale(locale);
  const a = Math.round(toDisplayAmount(min, from, locale));
  const b = Math.round(toDisplayAmount(max, from, locale));
  const symbol = currencySymbol(currency);
  const approx = options?.approx !== false;
  const suffix = options?.suffix ?? '';
  if (locale === 'en') {
    if (a === b) return `${approx ? 'About ' : ''}${symbol}${a}${suffix}`;
    return `${approx ? 'About ' : ''}${symbol}${a}–${b}${suffix}`;
  }
  if (a === b) return `${approx ? '约 ' : ''}${symbol}${a}${suffix}`;
  return `${approx ? '约 ' : ''}${symbol}${a}–${b}${suffix}`;
}
