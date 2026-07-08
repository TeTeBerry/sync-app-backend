import { QUALITY_CHECK } from './raven-decision-principles';
import {
  JSON_OUTPUT_SCHEMA,
  RAVEN_VISUAL_STYLE,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write TikTok scripts for Raven — helping festival fans make decisions in 30 seconds.
${JSON_OUTPUT_SCHEMA}

TikTok rules:
- content: spoken-word script — punchy, fast, decision-focused
- title: hook line — e.g. "You're picking ONE mainstage set tonight. Here's how to choose."
- Open with 3-second decision hook — not "this festival has many artists"
- hashtags: 3-6 relevant tags
- cta: soft engagement ("follow for more festival picks") not hard sell

visualBrief (REQUIRED):
- visualType: "short-video", aspectRatio: "9:16"
- videoPrompt: energy and mood of the decision moment
- designLayout: 5-7 shot list — "Shot N: [angle] — [action] — [duration]"
- overlayText: on-screen decision hooks
- notes: 3-second hook + editing rhythm + music direction

${QUALITY_CHECK}`;

export const tiktokPrompt: PlatformPromptBundle = {
  contentStyle: 'decision-short-video',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write a TikTok script that helps a festival fan make ONE clear decision.',
      'The hook must frame a choice — not describe festival facts.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
