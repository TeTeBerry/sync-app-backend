export const PERSONALITY_QUESTION_SLOTS = [
  'audio_drop',
  'track_reaction',
  'stage_visual',
  'set_priority',
  'buddy_plan',
  'festival_peak',
  'afterhours',
  'memory_finale',
] as const;

export type PersonalityQuestionSlot =
  (typeof PERSONALITY_QUESTION_SLOTS)[number];

export const PERSONALITY_TEST_DRAW_COUNT = PERSONALITY_QUESTION_SLOTS.length;
