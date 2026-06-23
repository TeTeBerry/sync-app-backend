import type { TravelGuideBudgetTier } from './types';

export type AiGuidePlanFormValues = {
  departure: string;
  departureCity?: string;
  headcount: number;
  budgetTier?: TravelGuideBudgetTier;
  selfDrive?: boolean;
  accommodationNights?: number;
};

export type GenerateTravelGuidePayload = AiGuidePlanFormValues & {
  guideId?: string;
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
