import {
  ANTI_PATTERNS,
  DECISION_FRAMEWORK,
  QUALITY_CHECK,
  RAVEN_IDENTITY,
} from '../raven-decision-principles';
import type { SeriesPromptBundle } from '../prompt-builder.types';

const TOPIC_EXAMPLES = [
  'Artists you cannot miss',
  'Hidden gems on the undercard',
  'Best artists by genre for your taste',
  'Best sets for different moods',
  'Artist conflicts — how to choose',
  'Who to watch if you like melodic techno',
  'First-timer lineup priorities',
];

const SYSTEM = `${RAVEN_IDENTITY}

Content series: Lineup Guide
Purpose: Help users understand a festival lineup and decide who to prioritize.

${DECISION_FRAMEWORK}

${ANTI_PATTERNS}

Focus on: experience, atmosphere, energy, crowd, festival context — not Wikipedia facts.
Never invent artists, set times, or stages not in festival data.

${QUALITY_CHECK}`;

export const lineupBreakdownPrompt: SeriesPromptBundle = {
  series: 'lineup_breakdown',
  system: SYSTEM,
  topicExamples: TOPIC_EXAMPLES,
  buildContextBlock: (input) => {
    const topicLine = input.topicHint?.trim()
      ? `Suggested topic angle: ${input.topicHint.trim()}`
      : `Pick ONE decision-focused topic from: ${TOPIC_EXAMPLES.join(' | ')}`;

    return [
      '=== CONTENT SERIES: Lineup Guide ===',
      topicLine,
      '',
      'Required decision metadata (populate JSON fields):',
      '- decisionQuestion: the choice the attendee is facing',
      '- targetAudience: who this recommendation is for (taste, experience level, constraints)',
      '- recommendation: your clear advice in one sentence',
      '- hook: opening line — strong decision hook, not a description',
      '- contentStructure: brief outline of the argument (1-2 sentences)',
      '',
      'Carousel structure (6 slides — populate carousel JSON):',
      'Slide 1: Decision hook — e.g. "You only have 3 days. These techno artists are worth planning around."',
      'Slide 2: Artist recommendation — name + sound identity + festival experience (not biography)',
      'Slide 3: Why this artist matters — energy, uniqueness, audience experience',
      'Slide 4: Who will enjoy this — "If you like: [similar artists]"',
      'Slide 5: When/where to watch — only if confirmed in data; otherwise "Check official timetable."',
      'Slide 6: Final recommendation — e.g. "Add this artist to your Raven festival plan." (soft CTA)',
      '',
      'Each slide: { slide, headline, body } — body gives actionable decision context, not generic facts.',
    ].join('\n');
  },
};
