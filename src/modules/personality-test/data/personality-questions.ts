import { PERSONALITY_TEST_DRAW_COUNT } from './personality-question-slots';
import { selectPersonalityQuestions } from '../utils/select-personality-questions.util';

/** @deprecated Use question pools + `selectPersonalityQuestions()` instead. */
export const PERSONALITY_TEST_QUESTIONS = selectPersonalityQuestions(() => 0);

export const PERSONALITY_TEST_QUESTION_COUNT = PERSONALITY_TEST_DRAW_COUNT;
