import type {
  TravelGuideAccommodationScheme,
  TravelGuideBudgetTier,
  TravelGuideHotelItem,
  TravelGuidePlan,
} from '@sync/travel-guide-contracts';
import type { RollingGoHotelRecommendation } from '../ports/travel-quote.types';
import {
  TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT,
  tierAccommodationSchemeLabel,
} from './travel-guide-accommodation.constants';
import { formatVenueDistanceLabel } from './travel-guide-venue-distance.util';
import { ABROAD_HOTEL_BOOKING_HINT } from './travel-guide-international.util';
import { TRAVEL_QUOTE_DISCLAIMER } from './travel-guide-quote.util';
import { formatTravelGuideMoney } from './travel-guide-currency.util';

const ROLLINGGO_HOTEL_BOOKING_HINT = 'RollingGo 查询参考 · OTA 比价预订';

function roomHint(headcount: number): string {
  if (headcount <= 1) return '1 人 1 间';
  const rooms = Math.ceil(headcount / 2);
  return `${headcount} 人 · 建议 ${rooms} 间`;
}

function formatNightlyPrice(
  price: number,
  currency: 'CNY' | 'USD',
  locale: 'zh' | 'en' = 'zh',
): string {
  return formatTravelGuideMoney(price, currency, locale, {
    suffix: locale === 'en' ? ' / night' : '/晚',
  });
}

export function rollingGoHotelToGuideItem(
  rec: RollingGoHotelRecommendation,
  input: {
    nightLabel: string;
    headcount: number;
    currency: 'CNY' | 'USD';
    index: number;
  },
): TravelGuideHotelItem {
  const price =
    rec.minPricePerNight != null
      ? formatNightlyPrice(rec.minPricePerNight, input.currency, 'zh')
      : '价格以实时查询为准';
  const star =
    rec.starRating != null && rec.starRating > 0
      ? ` · ${rec.starRating} 星`
      : '';
  const distance =
    rec.distanceM != null && rec.distanceM > 0
      ? ` · 距会场约 ${formatVenueDistanceLabel(rec.distanceM)}（直线）`
      : '';
  const addr = rec.address ? ` · ${rec.address}` : '';

  return {
    name: rec.name,
    note: `${price}${star}${distance}${addr} · ${input.nightLabel} · ${roomHint(input.headcount)}`,
    reason:
      input.index === 0
        ? `RollingGo 实时查询推荐；${TRAVEL_QUOTE_DISCLAIMER}`
        : `RollingGo 备选酒店；${TRAVEL_QUOTE_DISCLAIMER}`,
    bookingHint: rec.bookingUrl
      ? ROLLINGGO_HOTEL_BOOKING_HINT
      : ABROAD_HOTEL_BOOKING_HINT,
  };
}

export function rollingGoHotelSchemes(
  hotels: TravelGuideHotelItem[],
  tier: TravelGuideBudgetTier = 'standard',
): TravelGuideAccommodationScheme[] | undefined {
  if (!hotels.length) return undefined;
  return hotels
    .slice(0, TRAVEL_GUIDE_TIER_HOTEL_SCHEME_COUNT)
    .map((hotel, index) => ({
      label: tierAccommodationSchemeLabel(index, tier),
      name: hotel.name,
      note: hotel.note,
      reason: hotel.reason ?? TRAVEL_QUOTE_DISCLAIMER,
      bookingHint: hotel.bookingHint,
    }));
}

/** Replace generic overseas flight copy with RollingGo sample routes. */
export function mergeOverseasTransportWithRollingGo(
  lines: string[],
  sampleLines: string[],
): string[] {
  if (!sampleLines.length) return lines;
  const filtered = lines.filter(
    (line) =>
      !/建议从.*(?:国际航班|搭乘).*(?:飞往|至)/.test(line) &&
      !/往返机票建议提前 2–8 周关注/.test(line),
  );
  if (!filtered.length) return [...sampleLines];
  const [intro, ...rest] = filtered;
  return [intro!, ...sampleLines, ...rest];
}

export function applyOverseasRollingGoRecommendations(
  plan: TravelGuidePlan,
  input: {
    headcount: number;
    accommodationNights: number;
    currency: 'CNY' | 'USD';
    flightSampleLines?: string[];
    hotelRecommendations?: RollingGoHotelRecommendation[];
  },
): Pick<TravelGuidePlan, 'transport' | 'accommodation'> | null {
  let changed = false;
  let transportLines = [...plan.transport.lines];

  if (input.flightSampleLines?.length) {
    transportLines = mergeOverseasTransportWithRollingGo(
      transportLines,
      input.flightSampleLines,
    );
    changed = true;
  }

  let accommodation = plan.accommodation;
  if (input.accommodationNights > 0 && input.hotelRecommendations?.length) {
    const nightLabel = `${input.accommodationNights} 晚`;
    const hotels = input.hotelRecommendations.map((rec, index) =>
      rollingGoHotelToGuideItem(rec, {
        nightLabel,
        headcount: input.headcount,
        currency: input.currency,
        index,
      }),
    );
    accommodation = {
      title: '住宿推荐（RollingGo 参考）',
      hotels,
      schemes: rollingGoHotelSchemes(hotels),
    };
    changed = true;
  }

  if (!changed) return null;

  return {
    transport: { ...plan.transport, lines: transportLines },
    accommodation,
  };
}
