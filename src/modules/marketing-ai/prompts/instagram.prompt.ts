import {
  JSON_OUTPUT_SCHEMA,
  RAVEN_VISUAL_STYLE,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write Instagram captions AND visual briefs for festival travel content.
${JSON_OUTPUT_SCHEMA}

Instagram rules:
- Visual storytelling — caption supports imagery (carousel or single-image).
- Useful tips, guides, festival highlights, or countdown content.
- Include a soft CTA (save, share, comment) but not pushy sales copy.
- hashtags: 5-10 relevant tags without # prefix.
- Strong hook in the first line.

visualBrief (REQUIRED for Instagram):
- visualType: "carousel" for guide/tips/countdown; "single-image" if one hero visual fits better
- aspectRatio: "4:5"
- imagePrompt: detailed creative brief for designer/AI image generation
- designLayout: slide-by-slide or frame layout (e.g. Slide 1 hook, Slide 2 tip...)
- overlayText: key on-image text per slide/frame
- assetsNeeded: photos, icons, maps, lineup graphics needed
- referenceStyle: ${RAVEN_VISUAL_STYLE}
- notes: any extra art direction`;

export const instagramPrompt: PlatformPromptBundle = {
  contentStyle: 'visual-storytelling',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write an Instagram caption plus a complete visual brief for festival travel content.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
