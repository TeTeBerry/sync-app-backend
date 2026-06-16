import { RAVER_PERSONALITY_TYPES } from '../data/personality-types';
import type {
  PersonalityQuestion,
  PersonalityScoreResult,
  PersonalityTestAnswers,
  RaverPersonalityType,
} from '../personality-test.types';

function emptyScores(): Record<RaverPersonalityType, number> {
  return {
    rager: 0,
    connoisseur: 0,
    vibe_curator: 0,
    zen_raver: 0,
    documentarian: 0,
  };
}

function sortTypesByScore(
  scores: Record<RaverPersonalityType, number>,
): RaverPersonalityType[] {
  return [...RAVER_PERSONALITY_TYPES].sort((a, b) => scores[b] - scores[a]);
}

function tieBreakFromAnswers(
  tied: RaverPersonalityType[],
  answers: PersonalityTestAnswers,
  questions: PersonalityQuestion[],
): RaverPersonalityType {
  const tieBreakQuestions = [
    questions[questions.length - 1],
    questions[0],
  ].filter((question): question is PersonalityQuestion => Boolean(question));

  for (const question of tieBreakQuestions) {
    const selectedId = answers[question.id];
    const option = question.options.find((item) => item.id === selectedId);
    if (!option) continue;
    for (const type of tied) {
      if ((option.weights[type] ?? 0) > 0) {
        return type;
      }
    }
  }

  return tied[0] ?? 'rager';
}

export function scorePersonality(
  answers: PersonalityTestAnswers,
  questions: PersonalityQuestion[],
): PersonalityScoreResult {
  const scores = emptyScores();

  for (const question of questions) {
    const selectedId = answers[question.id];
    const option = question.options.find((item) => item.id === selectedId);
    if (!option) continue;

    const multiplier = question.weightMultiplier ?? 1;
    for (const type of RAVER_PERSONALITY_TYPES) {
      const weight = option.weights[type];
      if (weight) {
        scores[type] += weight * multiplier;
      }
    }
  }

  const ranked = sortTypesByScore(scores);
  const topScore = scores[ranked[0]];
  const tiedTop = ranked.filter((type) => scores[type] === topScore);
  const primaryType =
    tiedTop.length > 1
      ? tieBreakFromAnswers(tiedTop, answers, questions)
      : ranked[0];

  const remaining = ranked.filter((type) => type !== primaryType);
  const secondaryScore = scores[remaining[0]];
  const secondaryType =
    secondaryScore > 0 && secondaryScore >= topScore * 0.55
      ? remaining[0]
      : undefined;

  const total = RAVER_PERSONALITY_TYPES.reduce(
    (sum, type) => sum + scores[type],
    0,
  );
  const blendRatio =
    secondaryType && total > 0
      ? {
          primary: Math.round((scores[primaryType] / total) * 100),
          secondary: Math.round((scores[secondaryType] / total) * 100),
        }
      : undefined;

  return {
    primaryType,
    secondaryType,
    scores,
    blendRatio,
  };
}

export function isPersonalityTestComplete(
  answers: PersonalityTestAnswers,
  questions: PersonalityQuestion[],
): boolean {
  return questions.every((question) => Boolean(answers[question.id]));
}
