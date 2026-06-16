import { PERSONALITY_QUESTION_POOLS } from '../data/personality-question-pools';
import {
  PERSONALITY_QUESTION_SLOTS,
  PERSONALITY_TEST_DRAW_COUNT,
  type PersonalityQuestionSlot,
} from '../data/personality-question-slots';
import type { PersonalityQuestion } from '../personality-test.types';

function buildQuestionById(
  pools: Record<PersonalityQuestionSlot, PersonalityQuestion[]>,
): Map<string, PersonalityQuestion> {
  return new Map(
    Object.values(pools)
      .flat()
      .map((question) => [question.id, question]),
  );
}

function findQuestionSlot(
  questionId: string,
  pools: Record<PersonalityQuestionSlot, PersonalityQuestion[]>,
): PersonalityQuestionSlot | undefined {
  return PERSONALITY_QUESTION_SLOTS.find((slot) =>
    pools[slot].some((item) => item.id === questionId),
  );
}

function shuffleInPlace<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex]!, result[index]!];
  }
  return result;
}

export function selectPersonalityQuestions(
  random: () => number = Math.random,
  pools: Record<
    PersonalityQuestionSlot,
    PersonalityQuestion[]
  > = PERSONALITY_QUESTION_POOLS,
): PersonalityQuestion[] {
  const selected = PERSONALITY_QUESTION_SLOTS.map((slot) => {
    const pool = pools[slot];
    if (!pool.length) {
      throw new Error(`Personality question pool empty for slot: ${slot}`);
    }
    const index = Math.floor(random() * pool.length);
    return pool[Math.min(index, pool.length - 1)]!;
  });
  return shuffleInPlace(selected, random);
}

export function resolvePersonalityQuestionsByIds(
  questionIds: string[],
  pools: Record<
    PersonalityQuestionSlot,
    PersonalityQuestion[]
  > = PERSONALITY_QUESTION_POOLS,
): PersonalityQuestion[] {
  if (questionIds.length !== PERSONALITY_TEST_DRAW_COUNT) {
    return [];
  }

  const questionById = buildQuestionById(pools);
  const questions: PersonalityQuestion[] = [];
  const usedSlots = new Set<PersonalityQuestionSlot>();

  for (const questionId of questionIds) {
    const question = questionById.get(questionId);
    if (!question) {
      return [];
    }

    const slot = findQuestionSlot(questionId, pools);
    if (!slot || usedSlots.has(slot)) {
      return [];
    }
    usedSlots.add(slot);
    questions.push(question);
  }

  return questions;
}

export function isKnownPersonalityQuestionId(
  questionId: string,
  pools: Record<
    PersonalityQuestionSlot,
    PersonalityQuestion[]
  > = PERSONALITY_QUESTION_POOLS,
): boolean {
  return buildQuestionById(pools).has(questionId);
}
