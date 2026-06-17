import type {
  RankedMapPoi,
  TravelGuideRankedCandidates,
} from '../map/travel-guide-map.types';

export type TravelGuideLlmCandidatePoi = {
  name: string;
  address: string;
  distanceM: number;
  rating?: number;
  avgPrice?: number;
  category: string;
  lateNightFriendly: boolean;
};

export type TravelGuideLlmCandidates = {
  hotels: TravelGuideLlmCandidatePoi[];
  nightlife: TravelGuideLlmCandidatePoi[];
  parking: TravelGuideLlmCandidatePoi[];
};

function slimPoi(p: RankedMapPoi): TravelGuideLlmCandidatePoi {
  return {
    name: p.name,
    address: p.address,
    distanceM: p.distanceM,
    rating: p.rating,
    avgPrice: p.avgPrice,
    category: p.category,
    lateNightFriendly: p.lateNightFriendly,
  };
}

/** 压缩 POI 候选，减少 LLM 输入体积以加快润色响应。 */
export function compactCandidatesForLlm(
  ranked: TravelGuideRankedCandidates,
): TravelGuideLlmCandidates {
  return {
    hotels: ranked.hotels.slice(0, 6).map(slimPoi),
    nightlife: ranked.nightlife.slice(0, 6).map(slimPoi),
    parking: ranked.parking.slice(0, 4).map(slimPoi),
  };
}
