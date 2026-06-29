import type { TravelGuideBudgetItem } from '@sync/travel-guide-contracts';
import type { FlightQuoteSnapshot } from '../ports/travel-quote.types';
import {
  flightBudgetLabelForQuote,
  TRAVEL_QUOTE_DISCLAIMER,
} from './travel-guide-quote.util';
import type { TravelGuideRegionKind } from './travel-guide-international.util';

export function formatQuoteMoney(
  amount: number,
  currency: 'CNY' | 'USD',
): string {
  const rounded = Math.round(amount);
  if (currency === 'USD') return `$${rounded}`;
  return `¥${rounded}`;
}

export function formatQuoteMoneyRange(
  min: number,
  max: number,
  currency: 'CNY' | 'USD',
  options?: { suffix?: string },
): string {
  const suffix = options?.suffix ?? '';
  const symbol = currency === 'USD' ? '$' : '¥';
  const a = Math.round(min);
  const b = Math.round(max);
  if (min === max) return `约 ${symbol}${a}${suffix}`;
  return `约 ${symbol}${a}–${b}${suffix}`;
}

function formatQuoteDates(flight: FlightQuoteSnapshot): string {
  const outbound = flight.outboundDate.replace(/^\d{4}-/, '');
  if (!flight.returnDate) return `去程 ${outbound}`;
  const ret = flight.returnDate.replace(/^\d{4}-/, '');
  return `${outbound} 去 · ${ret} 返`;
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
  },
): TravelGuideBudgetItem {
  const { headcount, regionKind } = input;
  const { minPricePerAdult, maxPricePerAdult, currency, sampleLines } = flight;
  const baseLabel = flightBudgetLabelForQuote(regionKind, flight);
  const route = routeLabel(flight);

  const perPersonRange = formatQuoteMoneyRange(
    minPricePerAdult,
    maxPricePerAdult,
    currency,
    { suffix: '/人' },
  );
  const totalRange = formatQuoteMoneyRange(
    minPricePerAdult * headcount,
    maxPricePerAdult * headcount,
    currency,
  );

  const noteParts = [
    flight.cabinLabel,
    perPersonRange,
    headcount > 1
      ? `${headcount} 人合计 ${totalRange.replace(/^约 /, '')}`
      : null,
    formatQuoteDates(flight),
    flight.cabinFallback && flight.requestedCabinLabel
      ? `暂无${flight.requestedCabinLabel}，以下为${flight.cabinLabel ?? '经济舱'}参考价`
      : null,
    TRAVEL_QUOTE_DISCLAIMER,
  ].filter(Boolean);

  const details = flight.flightOffers?.length
    ? undefined
    : sampleLines
        .map((line) => line.trim())
        .filter(Boolean)
        .slice(0, 3);

  return {
    label: `${baseLabel} · ${route}`,
    range: headcount > 1 ? totalRange : perPersonRange,
    note: noteParts.join(' · '),
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
