import type { TravelGuideBudgetTier } from '../domain/travel-guide.types';

export type MapPoiKind =
  | 'hotel'
  | 'parking'
  | 'nightlife_club'
  | 'nightlife_food';

export interface RawMapPoi {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  category: string;
  distanceM: number;
  /** 可读距离文案（如 hot path 兜底 POI） */
  distanceLabel?: string;
  tel?: string;
  rating?: number;
  /** 餐饮人均等（元），酒店通常缺失 */
  avgPrice?: number;
  kind: MapPoiKind;
  keyword: string;
  /** 类别或名称暗示 24 小时 / 夜店 / 酒吧 */
  lateNightFriendly: boolean;
}

export interface GeocodedPlace {
  title: string;
  address: string;
  lat: number;
  lng: number;
}

export interface DrivingRouteSummary {
  distanceM: number;
  durationSec: number;
  distanceKm: number;
  durationMin: number;
}

export type TravelGuideGeoSource = 'hot_path' | 'database' | 'api' | 'none';

export interface ResolvedVenue {
  venue: GeocodedPlace;
  readableAddress: string;
  source: TravelGuideGeoSource;
}

export interface ResolvedTransport {
  driving?: DrivingRouteSummary;
  transit?: DrivingRouteSummary;
  walking?: DrivingRouteSummary;
  source: TravelGuideGeoSource;
  hotHubLabel?: string;
  transitHint?: string;
  /** 跨城或多段交通提示（优先于 transitHint 单条） */
  hintLines?: string[];
  /** 出发地与场馆跨城：交通文案应写城际段 + 抵深接驳，而非全程地铁 */
  interCity?: boolean;
}

export interface TravelGuideMapContext {
  venue: GeocodedPlace;
  venueReadableAddress: string;
  venueSource: TravelGuideGeoSource;
  departure?: GeocodedPlace;
  drivingRoute?: DrivingRouteSummary;
  transitRoute?: DrivingRouteSummary;
  transportSource: TravelGuideGeoSource;
  transportHints: string[];
  interCity?: boolean;
  pois: RawMapPoi[];
  eventEndHour: number;
  collectedAt: string;
}

export interface RankedMapPoi extends RawMapPoi {
  score: number;
  scoreBreakdown: {
    distance: number;
    rating: number;
    budget: number;
    lateNight: number;
  };
}

export interface TravelGuideAccommodationPicks {
  nearby: RankedMapPoi;
  cityCenter: RankedMapPoi;
}

export interface TravelGuideRankedCandidates {
  hotels: RankedMapPoi[];
  accommodationPicks?: TravelGuideAccommodationPicks;
  parking: RankedMapPoi[];
  nightlife: RankedMapPoi[];
  minHotelRating: number;
  budgetTier: TravelGuideBudgetTier;
  hotelPriceBand: [string, string];
}

export interface TravelGuideMapLlmInput {
  activityName: string;
  venueLabel: string;
  venueReadableAddress: string;
  venueSource: TravelGuideGeoSource;
  eventDates: string;
  departure: string;
  headcount: number;
  budgetTier: TravelGuideBudgetTier;
  budgetLabel: string;
  accommodationNights: number;
  selfDrive: boolean;
  eventEndHour: number;
  transportSource: TravelGuideGeoSource;
  transportHints: string[];
  interCity?: boolean;
  route?: DrivingRouteSummary & {
    departureTitle?: string;
    venueTitle?: string;
    mode?: 'driving' | 'transit';
  };
  candidates: TravelGuideRankedCandidates;
}
