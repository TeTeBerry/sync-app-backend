import type { TravelGuideBudgetItem } from '@sync/travel-guide-contracts';
import type { FlightQuoteSnapshot } from '../ports/travel-quote.types';
import {
  flightBudgetLabelForQuote,
  TRAVEL_QUOTE_DISCLAIMER,
} from './travel-guide-quote.util';
import type { TravelGuideRegionKind } from './travel-guide-international.util';
import {
  formatTravelGuideMoneyRange,
  type TravelGuideCurrency,
} from './travel-guide-currency.util';
import type { TravelGuideLocale } from './travel-guide-locale';

export function formatQuoteMoney(
  amount: number,
  currency: 'CNY' | 'USD',
  locale: TravelGuideLocale = 'zh',
): string {
  return formatTravelGuideMoneyRange(amount, amount, currency, locale, {
    approx: false,
  });
}

export function formatQuoteMoneyRange(
  min: number,
  max: number,
  currency: 'CNY' | 'USD',
  options?: { suffix?: string; locale?: TravelGuideLocale },
): string {
  const locale = options?.locale ?? 'zh';
  return formatTravelGuideMoneyRange(min, max, currency, locale, {
    suffix: options?.suffix,
  });
}

function formatQuoteDates(
  flight: FlightQuoteSnapshot,
  locale: TravelGuideLocale,
): string {
  const outbound = flight.outboundDate.replace(/^\d{4}-/, '');
  if (!flight.returnDate) {
    return locale === 'en' ? `Outbound ${outbound}` : `去程 ${outbound}`;
  }
  const ret = flight.returnDate.replace(/^\d{4}-/, '');
  return locale === 'en'
    ? `${outbound} out · ${ret} back`
    : `${outbound} 去 · ${ret} 返`;
}

function routeLabel(flight: FlightQuoteSnapshot): string {
  return `${flight.fromCityCode}→${flight.toCityCode}`;
}

/** RollingGo 机票预算项：含航线、人均/合计、参考航班明细。 */
export function buildRollingGoFlightBudgetItem(
  flight: FlightQuoteSnapshot,
  input: {
    headcount: number;
    regionKind: TravelGuideRegionKind;
    locale?: TravelGuideLocale;
  },
): TravelGuideBudgetItem {
  const { headcount, regionKind } = input;
  const locale = input.locale === 'en' ? 'en' : 'zh';
  const { minPricePerAdult, maxPricePerAdult, currency, sampleLines } = flight;
  const quoteCurrency = (currency ?? 'CNY') as TravelGuideCurrency;
  const baseLabel = flightBudgetLabelForQuote(regionKind, flight);
  const route = routeLabel(flight);

  const perPersonRange = formatQuoteMoneyRange(
    minPricePerAdult,
    maxPricePerAdult,
    quoteCurrency,
    {
      suffix: locale === 'en' ? ' / person' : '/人',
      locale,
    },
  );
  const totalRange = formatQuoteMoneyRange(
    minPricePerAdult * headcount,
    maxPricePerAdult * headcount,
    quoteCurrency,
    { locale },
  );

  const noteParts =
    locale === 'en'
      ? [
          flight.cabinLabel,
          perPersonRange,
          headcount > 1
            ? `${headcount} travelers total ${totalRange.replace(/^About /, '')}`
            : null,
          formatQuoteDates(flight, locale),
          flight.cabinFallback && flight.requestedCabinLabel
            ? `${flight.requestedCabinLabel} unavailable — showing ${flight.cabinLabel ?? 'Economy'} reference fares`
            : null,
          TRAVEL_QUOTE_DISCLAIMER,
        ]
      : [
          flight.cabinLabel,
          perPersonRange,
          headcount > 1
            ? `${headcount} 人合计 ${totalRange.replace(/^约 /, '')}`
            : null,
          formatQuoteDates(flight, locale),
          flight.cabinFallback && flight.requestedCabinLabel
            ? `暂无${flight.requestedCabinLabel}，以下为${flight.cabinLabel ?? '经济舱'}参考价`
            : null,
          TRAVEL_QUOTE_DISCLAIMER,
        ];

  const details = flight.flightOffers?.length
    ? undefined
    : sampleLines
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);

  return {
    label: `${baseLabel} · ${route}`,
    range: headcount > 1 ? totalRange : perPersonRange,
    note: noteParts.filter(Boolean).join(' · '),
    ...(details?.length ? { details } : {}),
  };
}

export function resolveFlightOfferCurrency(
  offers: Array<{ currency?: string }>,
): 'CNY' | 'USD' {
  if (!offers.length) return 'CNY';
  const counts = offers.reduce(
    (acc, offer) => {
      const raw = String(offer.currency ?? 'CNY').toUpperCase();
      const key = raw === 'USD' ? 'USD' : 'CNY';
      acc[key] += 1;
      return acc;
    },
    { CNY: 0, USD: 0 },
  );
  return counts.USD > counts.CNY ? 'USD' : 'CNY';
}
