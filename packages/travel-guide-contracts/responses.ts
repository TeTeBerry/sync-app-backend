import type { AiGuidePlanFormValues } from './dto';
import type {
  TravelGuideGenerationJobProgress,
  TravelGuideGenerationJobStatus,
} from './dto';
import type { TravelGuidePlan } from './types';

export interface GenerateTravelGuideResult {
  plan: TravelGuidePlan;
  guideId?: string;
}

export type TravelGuidePlanReadResult = {
  guideId: string;
  activityLegacyId: number;
  form: AiGuidePlanFormValues;
  plan: TravelGuidePlan;
  createdAt: string;
};

export type TravelGuideGenerationJobResult = {
  jobId: string;
  status: TravelGuideGenerationJobStatus;
  progress?: TravelGuideGenerationJobProgress;
  plan?: TravelGuidePlan;
  errorMessage?: string;
};
