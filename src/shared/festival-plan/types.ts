/** Server BFF payload for AI tab「本场计划」progress (matches client `FestivalPlanProgressInput`). */
export type FestivalPlanProgressDto = {
  activityLegacyId: number;
  hasTravelGuide: boolean;
  travelGuideId?: string;
  hasItinerary: boolean;
  itineraryDayCount?: number;
  itinerarySelectedDjIds?: string[];
  hasBuddyPost: boolean;
  buddyPostId?: string;
};
