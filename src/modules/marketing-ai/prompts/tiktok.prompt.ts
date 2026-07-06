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
- videoPrompt: overall video concept, mood, and opening energy
- designLayout: numbered 5-7 shot list — each line "Shot N: [angle] — [action] — [duration hint]"
- overlayText: on-screen text moments throughout the video (include hook text in first overlay)
- assetsNeeded: suggested B-roll (apps, tickets, packing, crowd shots, maps, transit, venue exteriors)
- notes: MUST include all of the following in one string:
  1) 3-second hook (exact opening line/visual)
  2) editing rhythm (fast cuts, beat drops, pacing between shots)
  3) music direction (genre, tempo, energy, when to duck under voiceover)
- referenceStyle: ${RAVEN_VISUAL_STYLE}`;

export const tiktokPrompt: PlatformPromptBundle = {
  contentStyle: 'short-video-script',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write a TikTok script plus a complete video brief for festival travel planning.',
      'The visual brief must be production-ready for a short vertical video editor.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
