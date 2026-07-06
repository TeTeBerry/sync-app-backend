import type { BuildMarketingPromptInput } from '../marketing-ai.types';

export type PlatformPromptBundle = {
  system: string;
  buildUserPrompt: (input: BuildMarketingPromptInput) => string;
  contentStyle: string;
};

export const VISUAL_BRIEF_JSON_FIELD = `"visualBrief":{
  "visualType":"carousel|single-image|reel|short-video|text-only",
  "imagePrompt":"string",
  "videoPrompt":"string",
  "designLayout":"string",
  "aspectRatio":"1:1|4:5|9:16|16:9",
  "assetsNeeded":["string"],
  "referenceStyle":"string",
  "overlayText":["string"],
  "notes":"string"
}`;

export const JSON_OUTPUT_SCHEMA = `Reply with JSON only, no markdown fences:
{"title":"string","content":"string","hashtags":["string"],"cta":"string","notes":"string",${VISUAL_BRIEF_JSON_FIELD}}
Rules:
- title: short headline (empty string if unused on this platform).
- content: main post body, platform-appropriate length and tone.
- hashtags: array of tags without # prefix (empty array if not applicable).
- cta: call-to-action line (empty string if not applicable).
- notes: optional brief production notes; empty string if none.
- visualBrief: follow platform-specific visual rules below.
- Do not promise tickets, prices, or availability unless explicitly in festival data.
- Do not invent lineup artists or dates not in festival data.`;

export const RAVEN_VISUAL_STYLE = `Visual style (when visuals are required):
- premium, dark background, purple/blue gradient, minimal
- festival travel aesthetic — Raven brand style
- NOT nightclub flyer, NOT overly crowded, NOT cheesy EDM poster`;

export function buildFestivalContextBlock(
  input: BuildMarketingPromptInput,
): string {
  const plannerType =
    typeof input.festival.plannerContentType === 'string'
      ? input.festival.plannerContentType
      : input.contentType;

  return [
    `Language: ${input.language}`,
    `Brand voice (context only — follow platform rules first): ${input.brandVoice}`,
    `Content type hint: ${input.contentType}`,
    `Planner content type: ${plannerType}`,
    'Festival context (JSON):',
    JSON.stringify(input.festival, null, 2),
  ].join('\n');
}
