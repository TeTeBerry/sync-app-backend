import {
  DECISION_FRAMEWORK,
  QUALITY_CHECK,
  RAVEN_IDENTITY,
} from '../raven-decision-principles';
import type { SeriesPromptBundle } from '../prompt-builder.types';

const TOPIC_EXAMPLES = [
  'Which day should you prioritize?',
  'Best stages for your taste',
  'Crowd expectations by day',
  'Schedule strategy for first-timers',
  'Hidden tips locals know',
  'Where to be at sunset vs peak time',
];

const SYSTEM = `${RAVEN_IDENTITY}

Content series: Festival Intelligence
Purpose: Help users make festival strategy decisions — best days, stages, crowd flow, schedule tactics.

${DECISION_FRAMEWORK}

Provide useful decisions, not festival trivia.
Never invent stages, dates, or crowd data not in festival context.

${QUALITY_CHECK}`;

export const festivalIntelligencePrompt: SeriesPromptBundle = {
  series: 'festival_intelligence',
  system: SYSTEM,
  topicExamples: TOPIC_EXAMPLES,
  buildContextBlock: (input) => {
    const topicLine = input.topicHint?.trim()
      ? `Strategy angle: ${input.topicHint.trim()}`
      : `Pick ONE from: ${TOPIC_EXAMPLES.join(' | ')}`;

    return [
      '=== CONTENT SERIES: Festival Intelligence ===',
      topicLine,
      '',
      'Required decision metadata:',
      '- decisionQuestion: e.g. "Which day gives you the best value for techno fans?"',
      '- recommendation: clear strategy advice',
      '- targetAudience: first-timer / genre fan / schedule optimizer',
      '',
      'Focus: best days, best stages, crowd expectations, schedule strategy, hidden tips.',
      'Every slide or paragraph must help the reader choose how to spend limited festival time.',
    ].join('\n');
  },
};
