import type { Activity } from '../../../database/schemas/activity.schema';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import { travelGuideRegionKind } from './travel-guide-international.util';
import {
  destinationCityFromActivityLocation,
  departureTextImpliesOtherCity,
} from '../map/travel-guide-intercity.util';
import type { TravelGuideMapContext } from '../map/travel-guide-map.types';
import { resolveTravelGuideBudgetTier } from './parse-activity-days.util';
import { reconcileDepartureCityForCache } from './travel-guide-generation-cache.util';
import type {
  FlightQuoteSnapshot,
  TravelQuoteQuery,
} from '../ports/travel-quote.types';
import { resolveTravelGuideLocale } from './travel-guide-locale';
import type { TravelGuideLocale } from './travel-guide-locale';

export type TravelQuoteActivity = Partial<
  Pick<
    Activity,
    'legacyId' | 'date' | 'location' | 'name' | 'region' | 'code' | 'area'
  >
>;

/** Whether RollingGo flight/hotel quotes apply (跨城或出发地明显为外地). */
export function shouldFetchTravelQuote(
  activity: TravelQuoteActivity,
  dto: GenerateTravelGuideDto,
  mapCtx: TravelGuideMapContext,
): boolean {
  if (travelGuideRegionKind(activity) !== 'domestic') return true;
  if (mapCtx.interCity) return true;
  const destinationCity = destinationCityFromActivityLocation(
    activity.location,
    activity.area,
  );
  if (!destinationCity.trim()) return false;
  return departureTextImpliesOtherCity(dto.departure.trim(), destinationCity);
}

export function buildTravelQuoteQuery(
  activity: TravelQuoteActivity,
  dto: GenerateTravelGuideDto,
  mapCtx: TravelGuideMapContext,
  accommodationNights: number,
): TravelQuoteQuery | null {
  if (!shouldFetchTravelQuote(activity, dto, mapCtx)) return null;

  const destinationCity = destinationCityFromActivityLocation(
    activity.location,
    activity.area,
  );
  if (!destinationCity.trim()) return null;

  return {
    departureText: dto.departure.trim(),
    departureCity:
      reconcileDepartureCityForCache(
        dto.departure.trim(),
        dto.departureCity?.trim(),
      ) || undefined,
    destinationCity,
    activityLegacyId: activity.legacyId,
    activityName: activity.name,
    activityCode: activity.code,
    activityArea: activity.area,
    activityLocation: activity.location,
    venueTitle: mapCtx.venue.title,
    venueAddress: mapCtx.venueReadableAddress || mapCtx.venue.address,
    regionKind: travelGuideRegionKind(activity),
    interCity: true,
    headcount: dto.headcount,
    accommodationNights,
    budgetTier: resolveTravelGuideBudgetTier(dto.budgetTier),
    // The traveller owns this window. Do not infer or broaden provider dates.
    outboundDate: dto.departureDate!,
    returnDate: dto.returnDate!,
    selfDrive: Boolean(dto.selfDrive),
    locale: resolveTravelGuideLocale(dto.locale),
  };
}

export function flightBudgetLabel(
  regionKind: TravelQuoteQuery['regionKind'],
  locale: TravelGuideLocale = 'zh',
): string {
  if (locale === 'en') {
    if (regionKind === 'overseas') return 'Flights (round-trip)';
    if (regionKind === 'hmt') return 'Flights / rail (round-trip)';
    return 'Intercity travel (rail / flights)';
  }
  if (regionKind === 'overseas') return '机票（往返）';
  if (regionKind === 'hmt') return '机票/高铁（往返）';
  return '城际交通（高铁/机票）';
}

export function flightBudgetLabelForQuote(
  regionKind: TravelQuoteQuery['regionKind'],
  flight: Pick<FlightQuoteSnapshot, 'fromCityCode' | 'toCityCode'>,
  locale: TravelGuideLocale = 'zh',
): string {
  if (flight.fromCityCode && flight.toCityCode) {
    if (locale === 'en') return 'Flights (round-trip)';
    if (regionKind === 'domestic') return '机票（往返）';
    if (regionKind === 'hmt') return '机票（往返）';
    return flightBudgetLabel(regionKind, locale);
  }
  return flightBudgetLabel(regionKind, locale);
}

export const TRAVEL_QUOTE_DISCLAIMER =
  '价格为 RollingGo 实时查询参考，SYNC 不提供购票订房服务，以航司/OTA 实际为准。';
