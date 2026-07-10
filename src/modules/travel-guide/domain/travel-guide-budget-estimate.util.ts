import type {
  TravelGuideBudgetTier,
  TravelGuideBudgetItem,
} from '@sync/travel-guide-contracts';
import { budgetTierHotelNightRanges } from './parse-activity-days.util';
import { findBudgetTierSnapshot } from './travel-guide-budget-tier-ranges.util';
import type { TravelGuideBudgetTierSnapshot } from '@sync/travel-guide-contracts';
import type { TravelGuideRegionKind } from './travel-guide-international.util';
import { getTravelGuideCopy } from './travel-guide-copy';
import {
  resolveTravelGuideLocale,
  type TravelGuideLocale,
} from './travel-guide-locale';
import { formatTravelGuideMoneyRange } from './travel-guide-currency.util';

function parseRangeMid(range: string): number {
  const nums = range.match(/\d+/g)?.map(Number) ?? [];
  if (!nums.length) return 0;
  if (nums.length === 1) return nums[0]!;
  return Math.round((nums[0]! + nums[1]!) / 2);
}

function formatRange(
  min: number,
  max: number,
  locale: TravelGuideLocale,
  perPerson = false,
  /** Source currency of the numeric amounts (defaults to CNY authored bands). */
  from: 'CNY' | 'USD' = 'CNY',
): string {
  return formatTravelGuideMoneyRange(min, max, from, locale, {
    suffix: perPerson ? (locale === 'en' ? ' / person' : '/人') : '',
  });
}

function roomCount(headcount: number): number {
  if (headcount <= 1) return 1;
  return Math.ceil(headcount / 2);
}

function tierWord(
  tier: TravelGuideBudgetTier,
  locale: TravelGuideLocale,
): string {
  if (locale === 'en') {
    if (tier === 'economy') return 'economy';
    if (tier === 'comfort') return 'premium';
    return 'comfort';
  }
  if (tier === 'economy') return '经济';
  if (tier === 'comfort') return '豪华';
  return '舒适';
}

export function buildTravelGuideBudgetItems(input: {
  budgetTier: TravelGuideBudgetTier;
  headcount: number;
  accommodationNights: number;
  interCity: boolean;
  regionKind: TravelGuideRegionKind;
  selfDrive: boolean;
  budgetTierSnapshots?: TravelGuideBudgetTierSnapshot[];
  locale?: TravelGuideLocale;
}): TravelGuideBudgetItem[] {
  const {
    budgetTier,
    headcount,
    accommodationNights,
    interCity,
    regionKind,
    selfDrive,
    budgetTierSnapshots,
  } = input;
  const locale = resolveTravelGuideLocale(input.locale);
  const copy = getTravelGuideCopy(locale);
  const labels = copy.budgetLabels;
  const rooms = roomCount(headcount);
  const tierSnap = findBudgetTierSnapshot(budgetTier, budgetTierSnapshots);
  let hotelMin: number;
  let hotelMax: number;
  if (tierSnap) {
    hotelMin = tierSnap.nightlyMin * rooms * accommodationNights;
    hotelMax = tierSnap.nightlyMax * rooms * accommodationNights;
  } else {
    const hotelRanges = budgetTierHotelNightRanges(budgetTier);
    const primaryMid = parseRangeMid(hotelRanges.primary);
    const secondaryMid = parseRangeMid(hotelRanges.secondary);
    const hotelMid = Math.round((primaryMid + secondaryMid) / 2);
    hotelMin = Math.round(hotelMid * 0.85) * rooms * accommodationNights;
    hotelMax = Math.round(hotelMid * 1.15) * rooms * accommodationNights;
  }

  const items: TravelGuideBudgetItem[] = [];
  const en = locale === 'en';

  if (interCity) {
    if (regionKind === 'overseas') {
      const min = 1800 * headcount;
      const max = 5500 * headcount;
      items.push({
        label: labels.flightRoundtrip,
        range: formatRange(min, max, locale),
        note: en
          ? 'Varies by origin city, booking window, and cabin — watch fares 2–8 weeks ahead.'
          : '视出发城市、购票时间与舱位浮动，建议提前 2–8 周关注。',
      });
    } else if (regionKind === 'hmt') {
      const min = 600 * headcount;
      const max = 2200 * headcount;
      items.push({
        label: labels.flightOrRailRoundtrip,
        range: formatRange(min, max, locale),
        note: en
          ? 'Includes border transfer; holiday and festival windows sell out fast.'
          : '含口岸接驳；节假日与电音节前后票量紧张。',
      });
    } else {
      const min = 400 * headcount;
      const max = 1600 * headcount;
      items.push({
        label: selfDrive ? labels.selfDriveFuelToll : labels.interCityTransport,
        range: formatRange(min, max, locale),
        note: selfDrive
          ? en
            ? 'Round-trip fuel and tolls; varies with distance from origin.'
            : '含往返油费与高速费，视出发地里程浮动。'
          : en
            ? 'Round-trip rail / flights — book early when possible.'
            : '含往返高铁/机票，建议提前购票。',
      });
    }
  } else if (selfDrive) {
    items.push({
      label: labels.selfDriveFuelParking,
      range: formatRange(80, 350, locale),
      note: en
        ? 'Same-city / nearby drive, including parking and urban detours.'
        : '同城/近郊自驾，含停车与市区拥堵绕行。',
    });
  }

  const ticketMin = regionKind === 'overseas' ? 800 : 380;
  const ticketMax = regionKind === 'overseas' ? 2200 : 1280;
  items.push({
    label: labels.tickets,
    range: formatRange(ticketMin * headcount, ticketMax * headcount, locale),
    note: en
      ? 'Follow official channels; VIP / multi-day tickets cost more. Early bird is usually better.'
      : '以官方渠道为准；VIP/多日票会更高，早鸟通常更划算。',
  });

  if (accommodationNights > 0) {
    items.push({
      label: labels.accommodation,
      range: formatRange(hotelMin, hotelMax, locale),
      note: en
        ? `Based on your ${tierWord(budgetTier, locale)} tier · ${accommodationNights} nights · ${rooms} room(s).`
        : `按您选择的${tierWord(budgetTier, locale)}档 · ${accommodationNights} 晚 · ${rooms} 间房估算。`,
    });
  }

  const transitDays =
    accommodationNights > 0 ? Math.max(accommodationNights, 2) : 1;
  const transitMin =
    regionKind === 'overseas'
      ? 120 * headcount * transitDays
      : 40 * headcount * transitDays;
  const transitMax =
    regionKind === 'overseas'
      ? 350 * headcount * transitDays
      : 120 * headcount * transitDays;
  items.push({
    label: labels.localTransport,
    range: formatRange(transitMin, transitMax, locale),
    note: en
      ? 'Airport/station to hotel, daily venue runs, and late rideshares; peak hours may cost more.'
      : '含机场/车站至酒店、每日往返会场、散场网约车；高峰可能上浮。',
  });

  const mealMin =
    regionKind === 'overseas'
      ? 120 * headcount * transitDays
      : 80 * headcount * transitDays;
  const mealMax =
    regionKind === 'overseas'
      ? 280 * headcount * transitDays
      : 180 * headcount * transitDays;
  items.push({
    label: labels.food,
    range: formatRange(mealMin, mealMax, locale),
    note: en
      ? 'On-site meals, late bites, and breakfast; fine dining not included.'
      : '含场内简餐、散场夜宵与早餐；奢享餐饮未计入。',
  });

  const miscMin =
    regionKind === 'overseas'
      ? 300 * headcount
      : regionKind === 'hmt'
        ? 200 * headcount
        : 150 * headcount;
  const miscMax =
    regionKind === 'overseas'
      ? 800 * headcount
      : regionKind === 'hmt'
        ? 500 * headcount
        : 400 * headcount;
  items.push({
    label: labels.misc,
    range: formatRange(miscMin, miscMax, locale),
    note:
      regionKind === 'overseas'
        ? en
          ? 'Visa / VOA, tips, souvenirs, emergency meds, and SIM / eSIM.'
          : '含签证/落地签、小费、纪念品、应急药品与 SIM 卡等。'
        : en
          ? 'Water, rain gear, lockers, merch, and contingency spend.'
          : '含水、雨衣、寄存、周边与应急支出。',
  });

  const subtotalMin = items.reduce((sum, item) => {
    const nums = item.range.match(/\d+/g)?.map(Number) ?? [];
    return sum + (nums[0] ?? 0);
  }, 0);
  const subtotalMax = items.reduce((sum, item) => {
    const nums = item.range.match(/\d+/g)?.map(Number) ?? [];
    return sum + (nums[nums.length - 1] ?? nums[0] ?? 0);
  }, 0);

  // Item ranges are already in the locale display currency — do not convert again.
  const displayFrom = locale === 'en' ? 'USD' : 'CNY';
  const perPersonMin = Math.round(subtotalMin / headcount);
  const perPersonMax = Math.round(subtotalMax / headcount);

  items.push({
    label: headcount > 1 ? labels.totalGroup : labels.totalSolo,
    range: formatRange(subtotalMin, subtotalMax, locale, false, displayFrom),
    note:
      headcount > 1
        ? en
          ? `${headcount}-person trip estimate; ${formatRange(perPersonMin, perPersonMax, locale, true, displayFrom)}, excluding shopping variance.`
          : `${headcount} 人全程合计估算；人均约 ¥${perPersonMin}–${perPersonMax}，不含购物与个人消费差异。`
        : en
          ? 'Solo trip estimate, excluding shopping and personal spend variance.'
          : '单人全程合计估算，不含购物与个人消费差异。',
  });

  return items;
}
