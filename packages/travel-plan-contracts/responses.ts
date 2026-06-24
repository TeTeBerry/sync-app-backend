import type { TravelPlanNodePayload } from './dto';

export type SavedTravelPlanNode = TravelPlanNodePayload & {
  timeLabel?: string;
  source?: 'activity' | 'user';
};

export type SavedTravelPlanResult = {
  saved: boolean;
  activityLegacyId?: number;
  eventMeta?: string;
  activityNodes?: SavedTravelPlanNode[];
  userNodes?: SavedTravelPlanNode[];
  nodes?: SavedTravelPlanNode[];
  activityConfirmations?: Record<string, boolean>;
  activityPriceOverrides?: Record<string, number>;
  hiddenActivityNodeIds?: string[];
  splitCount?: number;
  savedAt?: string;
};
