import {
  DECISION_FRAMEWORK,
  QUALITY_CHECK,
  RAVEN_IDENTITY,
} from '../raven-decision-principles';
import type { SeriesPromptBundle } from '../prompt-builder.types';

const TOPIC_EXAMPLES = [
  'Where to stay — tradeoffs by budget and vibe',
  'How to arrive — flight vs train vs car',
  'Transportation choices at the destination',
  'Budget planning for the full trip',
  'Pre-festival preparation checklist',
];

const SYSTEM = `${RAVEN_IDENTITY}

Content series: Travel Guide
Purpose: Help users make travel decisions — where to stay, how to arrive, transport, budget, preparation.

${DECISION_FRAMEWORK}

Give tradeoffs and recommendations, not generic destination descriptions.
Do not promise prices or availability unless in festival data.

${QUALITY_CHECK}`;

export const travelGuidePrompt: SeriesPromptBundle = {
  series: 'travel_guide',
  system: SYSTEM,
  topicExamples: TOPIC_EXAMPLES,
  buildContextBlock: (input) => {
    const topicLine = input.topicHint?.trim()
      ? `Travel decision angle: ${input.topicHint.trim()}`
      : `Pick ONE from: ${TOPIC_EXAMPLES.join(' | ')}`;

    return [
      '=== CONTENT SERIES: Travel Guide ===',
      topicLine,
      '',
      'Required decision metadata:',
      '- decisionQuestion: e.g. "Should you stay near the venue or in the city center?"',
      '- recommendation: clear advice with tradeoffs',
      '- targetAudience: budget traveler / group trip / first international festival',
      '',
      'Help users choose: lodging area, transport mode, budget tier, prep priorities.',
    ].join('\n');
  },
};
