import type { TravelGuideGenerationJobProgress } from '@sync/travel-guide-contracts';

export type TravelGuideProgressReporter = (
  progress: TravelGuideGenerationJobProgress,
) => void | Promise<void>;

export const TRAVEL_GUIDE_PROGRESS: Record<
  TravelGuideGenerationJobProgress['step'],
  TravelGuideGenerationJobProgress
> = {
  queued: { step: 'queued', percent: 2 },
  validating: { step: 'validating', percent: 8 },
  map_poi: { step: 'map_poi', percent: 22 },
  quotes_hotels: { step: 'quotes_hotels', percent: 36 },
  quotes_flights: { step: 'quotes_flights', percent: 50 },
  quotes: { step: 'quotes', percent: 36 },
  ai_writing: { step: 'ai_writing', percent: 66 },
  assembling: { step: 'assembling', percent: 84 },
  finishing: { step: 'finishing', percent: 94 },
  completed: { step: 'completed', percent: 100 },
};

export async function reportTravelGuideProgress(
  reporter: TravelGuideProgressReporter | undefined,
  step: TravelGuideGenerationJobProgress['step'],
): Promise<void> {
  if (!reporter) return;
  await reporter(TRAVEL_GUIDE_PROGRESS[step]);
}
