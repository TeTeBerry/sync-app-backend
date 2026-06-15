export type TravelPlanCategory =
  | 'flight'
  | 'transport'
  | 'hotel'
  | 'dining'
  | 'event';

export type TravelPlanNodeSource = 'activity' | 'user';

/** One parsed bill line from a transaction-list screenshot. */
export type TravelPlanBillLineItem = {
  id: string;
  title: string;
  description?: string;
  cost?: number;
  startDate: string;
  startTime?: string;
};

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
  /** Present when a dining node aggregates multiple bill lines from one screenshot. */
  diningBills?: TravelPlanBillLineItem[];
  /** Present when a transport node aggregates multiple ride-hailing bills. */
  transportBills?: TravelPlanBillLineItem[];
};

/** UI node with optional source and display label from API. */
export type TravelPlanNode = TravelPlanNodeRecord & {
  source?: TravelPlanNodeSource;
  timeLabel?: string;
};
