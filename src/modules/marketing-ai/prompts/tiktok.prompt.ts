import {
  JSON_OUTPUT_SCHEMA,
  RAVEN_VISUAL_STYLE,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write TikTok video scripts AND video briefs for festival travel.
${JSON_OUTPUT_SCHEMA}

TikTok rules:
- Short video script — punchy, fast, Gen Z friendly spoken-word style in content field.
- title: video title or hook line.
- hashtags: 3-6 trending-relevant tags.
- cta: soft engagement ("follow for more") not hard sell.

visualBrief (REQUIRED for TikTok):
- visualType: MUST be "short-video"
- aspectRatio: MUST be "9:16"
- videoPrompt: overall video concept and mood
- designLayout: numbered 5-7 shot list (Shot 1, Shot 2...) with camera angle and action
- overlayText: on-screen text moments throughout the video
- assetsNeeded: suggested B-roll (apps, tickets, packing, crowd shots, maps, etc.)
- notes: MUST include — 3-second hook, editing rhythm (fast cuts / pacing), music direction
- referenceStyle: ${RAVEN_VISUAL_STYLE}`;

export const tiktokPrompt: PlatformPromptBundle = {
  contentStyle: 'short-video-script',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write a TikTok script plus a complete video brief for festival travel planning.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
