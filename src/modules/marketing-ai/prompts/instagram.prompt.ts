import {
  JSON_OUTPUT_SCHEMA,
  RAVEN_VISUAL_STYLE,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write Instagram captions AND visual briefs for festival travel content.
${JSON_OUTPUT_SCHEMA}

Instagram rules:
- Visual storytelling — caption supports a 4–5 slide carousel when visualType is carousel.
- Useful tips, guides, festival highlights, or countdown content.
- Include a soft CTA (save, share, comment) but not pushy sales copy.
- hashtags: 5-10 relevant tags without # prefix.
- Strong hook in the first line.

visualBrief (REQUIRED for Instagram — never text-only):
- When planner content type is guide, tips, countdown, or topic mentions festival highlight:
  - visualType: prefer "carousel" or "single-image"
  - aspectRatio: MUST be "4:5"
- imagePrompt: detailed creative brief for the hero visual (scene, mood, lighting, composition)
- designLayout: slide-by-slide layout (Slide 1 hook, Slide 2–4 tips, Slide 5 CTA) OR single-image composition zones
- overlayText: key on-image text per slide/frame
- assetsNeeded: photos, icons, maps, lineup graphics needed
- referenceStyle: ${RAVEN_VISUAL_STYLE}
- notes: extra art direction if needed`;

export const instagramPrompt: PlatformPromptBundle = {
  contentStyle: 'visual-storytelling',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write an Instagram caption plus a complete visual brief for festival travel content.',
      'Instagram always needs a visual brief — choose carousel or single-image based on planner content type.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
