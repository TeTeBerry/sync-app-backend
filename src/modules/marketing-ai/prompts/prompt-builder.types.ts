import type { ContentSeries } from '../content-series.types';
import type { BuildMarketingPromptInput } from '../marketing-ai.types';

export type PlatformPromptBundle = {
  system: string;
  buildUserPrompt: (input: BuildMarketingPromptInput) => string;
  contentStyle: string;
};

export type SeriesPromptBundle = {
  series: ContentSeries;
  system: string;
  buildContextBlock: (input: SeriesGeneratorInput) => string;
  topicExamples?: string[];
};

export type SeriesGeneratorInput = BuildMarketingPromptInput & {
  seriesType: ContentSeries;
  artistContext?: Record<string, unknown>;
  topicHint?: string;
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

export const DECISION_JSON_FIELDS = `"decisionQuestion":"string — the choice the attendee faces",
"targetAudience":"string — who this is for",
"recommendation":"string — clear advice in one sentence",
"hook":"string — strong opening line, not a description",
"contentStructure":"string — brief outline of the argument"`;

export const CAROUSEL_JSON_FIELD = `"carousel":[{"slide":1,"headline":"string","body":"string"}]`;

export const JSON_OUTPUT_SCHEMA = `Reply with JSON only, no markdown fences:
{"title":"string","content":"string","hashtags":["string"],"cta":"string","notes":"string",${DECISION_JSON_FIELDS},${CAROUSEL_JSON_FIELD},${VISUAL_BRIEF_JSON_FIELD}}
Rules:
- title: short headline or SEO title (decision-framed, not encyclopedia).
- content: caption / post body / script — start with opinion or insight, not announcement.
- hashtags: array of tags without # prefix (empty array if not applicable).
- cta: call-to-action line (empty string if not applicable).
- notes: production notes, SEO meta description + outline, or quality-check self-notes.
- decisionQuestion, targetAudience, recommendation, hook, contentStructure: REQUIRED for guide/intelligence series; still populate for discussion when relevant.
- carousel: REQUIRED for Instagram carousel content — match series slide structure.
- visualBrief: follow platform-specific visual rules below.
- Do not promise tickets, prices, or availability unless explicitly in festival data.
- Do not invent lineup artists, set times, or stages not in festival data.
- Before returning: verify decision value (see quality check in series prompt).`;

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
