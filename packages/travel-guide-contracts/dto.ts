import type { TravelGuideBudgetTier } from './types';

export type TravelGuideLocale = 'zh' | 'en';
export type TravelGuideStayPreference = 'festival' | 'city' | 'value';

export type AiGuidePlanFormValues = {
  departure: string;
  departureCity?: string;
  headcount: number;
  budgetTier?: TravelGuideBudgetTier;
  selfDrive?: boolean;
  accommodationNights?: number;
  /** What should lead the stay recommendation: venue proximity, city energy, or price. */
  stayPreference?: TravelGuideStayPreference;
  note?: string;
  /** Plan copy language. Defaults to zh when omitted. */
  locale?: TravelGuideLocale;
};

export type GenerateTravelGuidePayload = AiGuidePlanFormValues & {
  guideId?: string;
  /** 重新生成时跳过服务端生成缓存，强制走完整 pipeline */
  forceRegenerate?: boolean;
};

export type TravelGuidePlaceSuggestion = {
  title: string;
  address: string;
  city?: string;
};

export type TravelGuideGenerationJobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed';

export type TravelGuideGenerationProgressStep =
  | 'queued'
  | 'validating'
  | 'map_poi'
  | 'quotes_hotels'
  | 'quotes_flights'
  /** @deprecated 兼容旧任务；新任务请用 quotes_hotels / quotes_flights */
  | 'quotes'
  | 'ai_writing'
  | 'assembling'
  | 'finishing'
  | 'completed';

export type TravelGuideGenerationJobProgress = {
  step: TravelGuideGenerationProgressStep;
  percent: number;
};
