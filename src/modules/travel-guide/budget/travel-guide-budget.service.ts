import { Injectable } from '@nestjs/common';
import type {
  TravelGuideBudgetItem,
  TravelGuideBudgetTier,
  TravelGuideBudgetTierSnapshot,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import { buildTravelGuideBudgetItems } from '../domain/travel-guide-budget-estimate.util';
import type { TravelGuideRegionKind } from '../domain/travel-guide-international.util';
import {
  budgetTierHotelNightRanges,
  resolveTravelGuideBudgetTier,
} from '../domain/parse-activity-days.util';
import {
  formatBudgetTierLabel,
  normalizeBudgetTierSnapshotsMonotonic,
} from '../domain/travel-guide-budget-tier-ranges.util';
import type { NormalizedFlightOption } from '../types/normalized-flight-option';
import type { NormalizedHotelOption } from '../types/normalized-hotel-option';
import type { NormalizedTicketOption } from '../types/normalized-ticket-option';
import type { PlanSelectedOptions } from '../types/plan-generation-context';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import {
  formatTravelGuideMoneyRange,
  type TravelGuideCurrency,
} from '../domain/travel-guide-currency.util';
import {
  roomCountFromTravelers,
  tierAliasFor,
  type TravelGuideBudgetConstraints,
} from './budget-constraints.types';
import {
  getTravelGuideCopy,
  isAccommodationBudgetLabel,
} from '../domain/travel-guide-copy';
import {
  resolveTravelGuideLocale,
  type TravelGuideLocale,
} from '../domain/travel-guide-locale';

/** Internal tier config — API still uses economy/standard/comfort. */
export const BUDGET_TIER_CONFIG = {
  economy: { alias: 'budget', label: '经济' },
  standard: { alias: 'balanced', label: '舒适' },
  comfort: { alias: 'premium', label: '豪华' },
} as const;

export interface BudgetRange {
  min: number;
  max: number;
}

export interface TravelGuideBudgetBreakdown {
  currency: 'CNY' | 'USD';
  tier: TravelGuideBudgetTier;
  tierAlias: 'budget' | 'balanced' | 'premium';
  flight?: BudgetRange;
  hotel?: BudgetRange;
  ticket?: BudgetRange;
  food?: BudgetRange;
  localTransport?: BudgetRange;
  total: BudgetRange;
  items: TravelGuideBudgetItem[];
}

@Injectable()
export class TravelGuideBudgetService {
  /**
   * Pre-recommendation estimated budget policy from configured tier tables.
   * Not live prices — used only to constrain / score recommendations.
   */
  resolveBudgetConstraints(input: {
    dto: GenerateTravelGuideDto;
    accommodationNights: number;
    regionKind: TravelGuideRegionKind;
    interCity: boolean;
    currency?: 'CNY' | 'USD';
  }): TravelGuideBudgetConstraints {
    const tier = resolveTravelGuideBudgetTier(input.dto.budgetTier);
    const travelers = Math.max(1, input.dto.headcount || 1);
    const nights = Math.max(0, input.accommodationNights);
    const rooms = roomCountFromTravelers(travelers);
    const currency = input.currency ?? 'CNY';

    const flightTarget = input.interCity
      ? flightTargetPerAdult(tier, input.regionKind)
      : undefined;
    const hotelTarget = nights > 0 ? hotelNightlyTarget(tier) : undefined;

    const ticketReserve = {
      min: (input.regionKind === 'overseas' ? 800 : 380) * travelers,
      max: (input.regionKind === 'overseas' ? 2200 : 1280) * travelers,
    };
    const days = nights > 0 ? Math.max(nights, 2) : 1;
    const foodReserve = {
      min: (input.regionKind === 'overseas' ? 120 : 80) * travelers * days,
      max: (input.regionKind === 'overseas' ? 280 : 180) * travelers * days,
    };
    const transportReserve = {
      min: (input.regionKind === 'overseas' ? 120 : 40) * travelers * days,
      max: (input.regionKind === 'overseas' ? 350 : 120) * travelers * days,
    };

    const flightTotal = flightTarget
      ? {
          min: (flightTarget.min ?? 0) * travelers,
          max: (flightTarget.max ?? 0) * travelers,
        }
      : undefined;
    const hotelTotal =
      hotelTarget && nights > 0
        ? {
            min: (hotelTarget.min ?? 0) * rooms * nights,
            max: (hotelTarget.max ?? 0) * rooms * nights,
          }
        : undefined;

    const totalTarget = {
      min:
        (flightTotal?.min ?? 0) +
        (hotelTotal?.min ?? 0) +
        ticketReserve.min +
        foodReserve.min +
        transportReserve.min,
      max:
        (flightTotal?.max ?? 0) +
        (hotelTotal?.max ?? 0) +
        ticketReserve.max +
        foodReserve.max +
        transportReserve.max,
    };

    return {
      tier,
      tierAlias: tierAliasFor(tier),
      currency,
      travelers,
      nights,
      rooms,
      interCity: input.interCity,
      totalTarget,
      ...(flightTarget ? { flightTarget } : {}),
      ...(hotelTarget ? { hotelTarget } : {}),
      ticketReserve,
      foodReserve,
      transportReserve,
      estimated: true,
    };
  }

  buildItems(input: {
    budgetTier: TravelGuideBudgetTier;
    headcount: number;
    accommodationNights: number;
    interCity: boolean;
    regionKind: TravelGuideRegionKind;
    selfDrive: boolean;
    budgetTierSnapshots?: TravelGuideBudgetTierSnapshot[];
    locale?: TravelGuideLocale;
  }): TravelGuideBudgetItem[] {
    return buildTravelGuideBudgetItems(input);
  }

  /**
   * Post-selection final budget summary (authoritative for response.budget).
   * Uses selected flight/hotel/ticket prices when present; otherwise tier estimates.
   */
  buildFromSelected(input: {
    budgetTier: TravelGuideBudgetTier;
    headcount: number;
    accommodationNights: number;
    interCity: boolean;
    regionKind: TravelGuideRegionKind;
    selfDrive: boolean;
    selected: PlanSelectedOptions;
    flights?: NormalizedFlightOption[];
    hotels?: NormalizedHotelOption[];
    tickets?: NormalizedTicketOption[];
    budgetTierSnapshots?: TravelGuideBudgetTierSnapshot[];
    locale?: TravelGuideLocale;
  }): TravelGuideBudgetBreakdown {
    const locale = resolveTravelGuideLocale(input.locale);
    const labels = getTravelGuideCopy(locale).budgetLabels;
    const baseItems = this.buildItems({
      budgetTier: input.budgetTier,
      headcount: input.headcount,
      accommodationNights: input.accommodationNights,
      interCity: input.interCity,
      regionKind: input.regionKind,
      selfDrive: input.selfDrive,
      budgetTierSnapshots: input.budgetTierSnapshots,
      locale,
    });

    const items = baseItems.map((item) => ({ ...item }));
    const currency = resolveCurrency(
      input.selected,
      input.flights,
      input.hotels,
    );
    const en = locale === 'en';

    if (input.selected.flight && input.interCity) {
      const amount = input.selected.flight.price.amount * input.headcount;
      replaceOrInsert(items, isFlightLabel, {
        label:
          input.regionKind === 'hmt'
            ? labels.flightOrRailRoundtrip
            : labels.flightRoundtrip,
        range: formatMoneyRange(amount, amount, currency, locale),
        note: en
          ? 'Based on recommended flight reference price (group total); confirm live fares on airline / OTA.'
          : '基于推荐航班参考价（全员合计）；购票时以航司/OTA 实时为准。',
      });
    }

    if (input.selected.hotel && input.accommodationNights > 0) {
      const nightly =
        input.selected.hotel.price?.nightlyAmount ??
        (input.selected.hotel.price?.totalAmount
          ? input.selected.hotel.price.totalAmount /
            Math.max(1, input.accommodationNights)
          : 0);
      const rooms = input.headcount <= 1 ? 1 : Math.ceil(input.headcount / 2);
      const total = Math.round(nightly * rooms * input.accommodationNights);
      if (total > 0) {
        replaceOrInsert(items, isAccommodationBudgetLabel, {
          label: labels.accommodation,
          range: formatMoneyRange(total, total, currency, locale),
          note: en
            ? `Based on recommended hotel reference · ${rooms} room(s) · ${input.accommodationNights} nights.`
            : `基于推荐酒店参考价 · ${rooms} 间 · ${input.accommodationNights} 晚。`,
        });
      }
    }

    if (input.selected.ticket?.price?.amount) {
      const amount = input.selected.ticket.price.amount * input.headcount;
      replaceOrInsert(items, isTicketLabel, {
        label: labels.tickets,
        range: formatMoneyRange(amount, amount, currency, locale),
        note:
          input.selected.ticket.note ??
          (en
            ? 'Based on verified ticket-channel reference price.'
            : '基于已核验票务渠道参考价。'),
      });
    }

    recalculateTotal(items, input.headcount, currency, locale);

    return this.summarizeFromItems(items, input.budgetTier, currency);
  }

  resolveTierLabel(
    tier: TravelGuideBudgetTier,
    snapshots?: TravelGuideBudgetTierSnapshot[],
    locale: TravelGuideLocale = 'zh',
  ): string {
    const normalized =
      snapshots?.length === 3
        ? normalizeBudgetTierSnapshotsMonotonic(snapshots)
        : snapshots;
    return formatBudgetTierLabel(tier, normalized, locale);
  }

  summarizeFromPlan(
    plan: TravelGuidePlan,
    tier: TravelGuideBudgetTier,
  ): TravelGuideBudgetBreakdown {
    const items = plan.budget?.items ?? [];
    const currency: 'CNY' | 'USD' =
      (plan.flightByTier?.[tier]?.currency ??
      plan.hotelByTier?.[tier]?.hotels?.[0]?.note?.includes('USD'))
        ? 'USD'
        : 'CNY';
    return this.summarizeFromItems(items, tier, currency);
  }

  summarizeFromItems(
    items: TravelGuideBudgetItem[],
    tier: TravelGuideBudgetTier,
    currency: 'CNY' | 'USD' = 'CNY',
  ): TravelGuideBudgetBreakdown {
    const flight = rangeFromItems(items, [
      /机票/,
      /城际交通/,
      /高铁/,
      /Flights/i,
      /Intercity travel/i,
      /rail/i,
    ]);
    const hotel = rangeFromItems(items, [/^住宿/, /^Accommodation\b/i]);
    const ticket = rangeFromItems(items, [/门票/, /票务/, /^Tickets\b/i]);
    const food = rangeFromItems(items, [
      /餐饮/,
      /饮食/,
      /夜宵/,
      /Food/i,
      /drinks/i,
    ]);
    const localTransport = rangeFromItems(items, [
      /市内交通/,
      /接驳/,
      /打车/,
      /停车/,
      /自驾/,
      /Local transport/i,
      /Self-drive/i,
      /venue transfer/i,
    ]);
    const total =
      rangeFromItems(items, [/^合计/, /Estimated total/i]) ??
      sumRanges([flight, hotel, ticket, food, localTransport]);

    return {
      currency,
      tier,
      tierAlias: BUDGET_TIER_CONFIG[tier].alias,
      flight,
      hotel,
      ticket,
      food,
      localTransport,
      total: total ?? { min: 0, max: 0 },
      items,
    };
  }
}

function flightTargetPerAdult(
  tier: TravelGuideBudgetTier,
  regionKind: TravelGuideRegionKind,
): { min: number; max: number } {
  if (regionKind === 'overseas') {
    if (tier === 'economy') return { min: 1800, max: 3200 };
    if (tier === 'comfort') return { min: 3500, max: 5500 };
    return { min: 2500, max: 4200 };
  }
  if (regionKind === 'hmt') {
    if (tier === 'economy') return { min: 600, max: 1200 };
    if (tier === 'comfort') return { min: 1400, max: 2200 };
    return { min: 900, max: 1600 };
  }
  if (tier === 'economy') return { min: 400, max: 900 };
  if (tier === 'comfort') return { min: 1000, max: 1600 };
  return { min: 600, max: 1200 };
}

function hotelNightlyTarget(tier: TravelGuideBudgetTier): {
  min: number;
  max: number;
} {
  const ranges = budgetTierHotelNightRanges(tier);
  const primary = parseMoneyRange(ranges.primary);
  const secondary = parseMoneyRange(ranges.secondary);
  return {
    min: primary.min,
    max: Math.max(primary.max, secondary.max),
  };
}

function parseMoneyRange(raw: string): { min: number; max: number } {
  const nums = raw.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return { min: 0, max: 0 };
  if (nums.length === 1) return { min: nums[0]!, max: nums[0]! };
  return { min: nums[0]!, max: nums[nums.length - 1]! };
}

function isFlightLabel(label: string): boolean {
  return /机票|城际交通|高铁|Flights|Intercity travel|rail/i.test(label);
}

function isTicketLabel(label: string): boolean {
  return /门票|票务|^Tickets\b/i.test(label);
}

function isTotalLabel(label: string): boolean {
  return label.startsWith('合计') || /Estimated total/i.test(label);
}

function resolveCurrency(
  selected: PlanSelectedOptions,
  flights?: NormalizedFlightOption[],
  hotels?: NormalizedHotelOption[],
): 'CNY' | 'USD' {
  return (
    selected.flight?.price.currency ??
    selected.hotel?.price?.currency ??
    flights?.[0]?.price.currency ??
    hotels?.[0]?.price?.currency ??
    'CNY'
  );
}

function formatMoneyRange(
  min: number,
  max: number,
  currency: 'CNY' | 'USD',
  locale: TravelGuideLocale = 'zh',
): string {
  return formatTravelGuideMoneyRange(
    min,
    max,
    currency as TravelGuideCurrency,
    locale,
  );
}

function replaceOrInsert(
  items: TravelGuideBudgetItem[],
  match: (label: string) => boolean,
  patch: TravelGuideBudgetItem,
): void {
  const idx = items.findIndex((item) => match(item.label));
  if (idx >= 0) {
    items[idx] = patch;
    return;
  }
  const totalIdx = items.findIndex((item) => isTotalLabel(item.label));
  if (totalIdx >= 0) {
    items.splice(totalIdx, 0, patch);
    return;
  }
  items.push(patch);
}

function recalculateTotal(
  items: TravelGuideBudgetItem[],
  headcount: number,
  currency: 'CNY' | 'USD',
  locale: TravelGuideLocale = 'zh',
): void {
  let min = 0;
  let max = 0;
  for (const item of items) {
    if (isTotalLabel(item.label)) continue;
    const range = parseRange(item.range);
    if (!range) continue;
    min += range.min;
    max += range.max;
  }
  const labels = getTravelGuideCopy(locale).budgetLabels;
  const totalLabel = headcount > 1 ? labels.totalGroup : labels.totalSolo;
  const totalItem: TravelGuideBudgetItem = {
    label: totalLabel,
    // Parsed item ranges are already in the locale display currency.
    range: formatMoneyRange(min, max, locale === 'en' ? 'USD' : 'CNY', locale),
    note:
      headcount > 1
        ? locale === 'en'
          ? `Trip total estimate for ${headcount} people.`
          : `以上各项为本次出行合计估算（${headcount} 人）。`
        : locale === 'en'
          ? 'Solo trip total estimate.'
          : '以上各项为单人合计估算。',
  };
  const totalIdx = items.findIndex((item) => isTotalLabel(item.label));
  if (totalIdx >= 0) items[totalIdx] = totalItem;
  else items.push(totalItem);
}

function parseRange(range: string): BudgetRange | undefined {
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return undefined;
  if (nums.length === 1) return { min: nums[0]!, max: nums[0]! };
  return { min: nums[0]!, max: nums[nums.length - 1]! };
}

function rangeFromItems(
  items: TravelGuideBudgetItem[],
  patterns: RegExp[],
): BudgetRange | undefined {
  const matched = items.filter((item) =>
    patterns.some((pattern) => pattern.test(item.label)),
  );
  if (!matched.length) return undefined;
  let min = 0;
  let max = 0;
  for (const item of matched) {
    const range = parseRange(item.range);
    if (!range) continue;
    min += range.min;
    max += range.max;
  }
  return min || max ? { min, max } : undefined;
}

function sumRanges(
  ranges: Array<BudgetRange | undefined>,
): BudgetRange | undefined {
  const present = ranges.filter((r): r is BudgetRange => Boolean(r));
  if (!present.length) return undefined;
  return present.reduce(
    (acc, cur) => ({ min: acc.min + cur.min, max: acc.max + cur.max }),
    { min: 0, max: 0 },
  );
}
