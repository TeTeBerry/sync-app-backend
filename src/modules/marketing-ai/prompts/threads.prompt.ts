import { QUALITY_CHECK } from './raven-decision-principles';
import {
  JSON_OUTPUT_SCHEMA,
  RAVEN_VISUAL_STYLE,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write native Threads posts for Raven's festival community.
${JSON_OUTPUT_SCHEMA}

Threads rules:
- Do NOT copy Instagram captions — this is a conversation starter, not a carousel repost
- Lead with: discussion question, hot take, controversial opinion, or poll-style prompt
- Short, casual, native to Threads — 0-2 emojis max, often zero
- No hard sell, no "download", no "sign up", no product pitch
- hashtags: 0-4 optional; cta: empty or soft community invite only
- content field: the Threads post text — question or opinion first

Examples:
"Hot take: The best Tomorrowland set is rarely the biggest name. Agree?"
"Which artist would you never miss at a festival?"

visualBrief for Threads:
- DEFAULT: visualType "text-only"
- ONLY for checklist-style travel/packing guides: single-image, 1:1, ${RAVEN_VISUAL_STYLE}

${QUALITY_CHECK}`;

export const threadsPrompt: PlatformPromptBundle = {
  contentStyle: 'community-discussion',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write a Threads post that sparks festival fan conversation.',
      'If content series is community_discussion — pure discussion prompt, no caption style.',
      'If other series — frame as a question or hot take, not an Instagram carousel summary.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
