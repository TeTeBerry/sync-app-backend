import type { TravelPlanCategory, TravelPlanNodeRecord } from './types';

export type TravelPlanNodePayload = TravelPlanNodeRecord;

export type SaveTravelPlanPayload = {
  eventMeta?: string;
  nodes: TravelPlanNodePayload[];
  activityConfirmations?: Record<string, boolean>;
  activityPriceOverrides?: Record<string, number>;
  hiddenActivityNodeIds?: string[];
};

export type SaveTravelPlanResult = {
  ok: true;
  activityLegacyId: number;
  savedAt: string;
  nodeCount: number;
};

export const TRAVEL_PLAN_RECEIPT_CATEGORIES = [
  'transport',
  'hotel',
  'dining',
  'event',
] as const;

export type TravelPlanReceiptCategory =
  (typeof TRAVEL_PLAN_RECEIPT_CATEGORIES)[number];

export type TravelPlanReceiptRecognizeForm = {
  title: string;
  description: string;
  cost: string;
  remark: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
};

export type RecognizeTravelPlanReceiptPayload = {
  category: TravelPlanReceiptCategory;
  /** Local dev: JPEG data URL. Production weapp: CloudBase temp HTTPS URL from getTempFileURL. */
  image: string;
};

export type RecognizeTravelPlanReceiptResult = {
  ok: true;
  filled: boolean;
  category: TravelPlanReceiptCategory;
  form?: TravelPlanReceiptRecognizeForm;
  forms?: TravelPlanReceiptRecognizeForm[];
  message?: string;
};
