import { PERSONALITY_QUESTION_POOLS } from './personality-question-pools';
import { PERSONALITY_QUESTION_SLOTS } from './personality-question-slots';

export type PersonalityQuestionCatalogSeed = {
  questionId: string;
  slot: string;
  prompt: string;
  media?: (typeof PERSONALITY_QUESTION_POOLS)[keyof typeof PERSONALITY_QUESTION_POOLS][number]['media'];
  weightMultiplier?: number;
  options: (typeof PERSONALITY_QUESTION_POOLS)[keyof typeof PERSONALITY_QUESTION_POOLS][number]['options'];
  active: boolean;
  catalogVersion: number;
};

export const PERSONALITY_TEST_CATALOG_VERSION = 2;

export function buildPersonalityCatalogSeed(): PersonalityQuestionCatalogSeed[] {
  return PERSONALITY_QUESTION_SLOTS.flatMap((slot) =>
    PERSONALITY_QUESTION_POOLS[slot].map((question) => ({
      questionId: question.id,
      slot,
      prompt: question.prompt,
      media: question.media,
      weightMultiplier: question.weightMultiplier,
      options: question.options,
      active: true,
      catalogVersion: PERSONALITY_TEST_CATALOG_VERSION,
    })),
  );
}
