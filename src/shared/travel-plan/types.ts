export type TravelPlanCategory =
  | 'flight'
  | 'transport'
  | 'hotel'
  | 'dining'
  | 'event';

export type TravelPlanNodeSource = 'activity' | 'user';

/** Persisted/API node shape (no UI-only fields). */
export type TravelPlanNodeRecord = {
  id: string;
  category: TravelPlanCategory;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  duration?: string;
  title: string;
  subtitle: string;
  detail?: string;
  price?: number;
  confirmed: boolean;
};

/** UI node with optional source and display label from API. */
export type TravelPlanNode = TravelPlanNodeRecord & {
  source?: TravelPlanNodeSource;
  timeLabel?: string;
};
