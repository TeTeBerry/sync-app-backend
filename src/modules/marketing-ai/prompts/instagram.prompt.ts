import { CAPTION_RULES, QUALITY_CHECK } from './raven-decision-principles';
import {
  JSON_OUTPUT_SCHEMA,
  RAVEN_VISUAL_STYLE,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write Instagram captions AND visual briefs for Raven — a festival decision companion.
${JSON_OUTPUT_SCHEMA}

${CAPTION_RULES}

Instagram rules:
- Carousel-first for lineup/artist/travel guides — 4-7 slides with decision hooks per slide
- Caption (content field) opens with strong opinion — encourage saves and comments
- hashtags: 5-10 relevant tags without # prefix
- Soft CTA (save, plan, comment) — not pushy sales copy

visualBrief (REQUIRED for Instagram — never text-only):
- visualType: prefer "carousel" for guides; "single-image" only when one clear decision fits one frame
- aspectRatio: MUST be "4:5"
- imagePrompt: mood and atmosphere of the festival experience — not generic EDM flyer
- designLayout: slide-by-slide layout matching carousel decision structure
- overlayText: on-image text per slide — decision hooks, not artist bios
- assetsNeeded: lineup graphics, stage vibes, crowd energy references
- referenceStyle: ${RAVEN_VISUAL_STYLE}

${QUALITY_CHECK}`;

export const instagramPrompt: PlatformPromptBundle = {
  contentStyle: 'decision-visual-storytelling',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write an Instagram carousel + caption that helps a festival fan make a decision.',
      'Populate carousel JSON with full slide structure from the content series.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
