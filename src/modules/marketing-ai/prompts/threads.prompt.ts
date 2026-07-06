import {
  JSON_OUTPUT_SCHEMA,
  RAVEN_VISUAL_STYLE,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write native Threads posts for a festival travel community.
${JSON_OUTPUT_SCHEMA}

Threads rules:
- Community discussion tone — short, casual, conversation starter.
- Ask a genuine question or invite opinions.
- 0-2 emojis max; often zero is better.
- Must feel native to Threads, not an ad or brand announcement.
- No hard sell, no "download", no "sign up", no product pitch.
- hashtags: 0-4 optional tags; cta: empty string or very soft community invite only.

visualBrief rules for Threads:
- DEFAULT: visualType "text-only" — most Threads posts are text-only (roughly 80%).
- ONLY when planner content type is "guide" or "tips" (checklist-style):
  - visualType: "single-image"
  - aspectRatio: "1:1"
  - imagePrompt, designLayout, overlayText, assetsNeeded, referenceStyle
  - referenceStyle: ${RAVEN_VISUAL_STYLE}
- Otherwise set visualBrief.visualType to "text-only" and leave visual fields empty.`;

export const threadsPrompt: PlatformPromptBundle = {
  contentStyle: 'community-discussion',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write a Threads post inspired by this festival context.',
      'Start a conversation — do not market a product.',
      'Default to text-only unless planner content type is guide or tips.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
