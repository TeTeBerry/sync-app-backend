import type { TravelGuidePlan } from '@sync/travel-guide-contracts';
import {
  shouldFetchTravelQuote,
  type TravelQuoteActivity,
} from './travel-guide-quote.util';
import type { GenerateTravelGuideDto } from '../dto/generate-travel-guide.dto';
import type { TravelGuideMapContext } from '../map/travel-guide-map.types';
import { destinationCityFromActivityLocation } from '../map/travel-guide-intercity.util';

/** 生成缓存命中时补跑 RollingGo 报价所需的最小 mapCtx。 */
export function buildMinimalMapContextForQuote(
  plan: TravelGuidePlan,
  activity: TravelQuoteActivity,
  dto: GenerateTravelGuideDto,
): TravelGuideMapContext {
  const destinationCity = destinationCityFromActivityLocation(
    activity.location,
    activity.area,
  );
  const baseCtx: TravelGuideMapContext = {
    venue: {
      title: plan.venue.trim() || activity.name?.trim() || destinationCity,
      address:
        activity.location?.trim() || plan.venue.trim() || destinationCity,
      lat: 0,
      lng: 0,
    },
    venueReadableAddress:
      plan.venue.trim() || activity.location?.trim() || destinationCity,
    venueSource: 'hot_path',
    transportSource: 'hot_path',
    transportHints: [],
    interCity: false,
    pois: [],
    eventEndHour: 23.5,
    collectedAt: new Date().toISOString(),
  };
  const interCity = shouldFetchTravelQuote(activity, dto, baseCtx);

  return {
    ...baseCtx,
    interCity,
  };
}
