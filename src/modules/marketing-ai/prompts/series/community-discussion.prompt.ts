import { QUALITY_CHECK, RAVEN_IDENTITY } from '../raven-decision-principles';
import type { SeriesPromptBundle } from '../prompt-builder.types';

const PROMPT_EXAMPLES = [
  'Hot take: the best set is rarely the biggest name. Agree?',
  'Which artist would you never miss at a festival?',
  'Is [festival] worth the long-haul trip this year?',
  'Mainstage vs undercard — where do you find the best moments?',
  'Poll-style: pick one — sunset set or 2am warehouse?',
];

const SYSTEM = `${RAVEN_IDENTITY}

Content series: Community Discussion
Purpose: Create conversations among festival fans — hot takes, opinions, comparisons, poll-style prompts.

This is NOT news. This is NOT a caption repost.
Spark genuine debate and community engagement.

${QUALITY_CHECK}`;

export const communityDiscussionPrompt: SeriesPromptBundle = {
  series: 'community_discussion',
  system: SYSTEM,
  buildContextBlock: (input) => {
    const topicLine = input.topicHint?.trim()
      ? `Discussion angle: ${input.topicHint.trim()}`
      : `Inspiration (adapt, do not copy): ${PROMPT_EXAMPLES.join(' | ')}`;

    return [
      '=== CONTENT SERIES: Community Discussion ===',
      topicLine,
      '',
      'Threads rules:',
      '- Lead with a discussion question, controversial opinion, or community prompt',
      '- Do NOT copy Instagram caption style',
      '- Invite replies — "Agree?" / "Who else?" / "What would you pick?"',
      '',
      'Examples:',
      '"Hot take: The best Tomorrowland set is rarely the biggest name. Agree?"',
      '"Which artist would you never miss at a festival?"',
    ].join('\n');
  },
};
