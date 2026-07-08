import { QUALITY_CHECK } from './raven-decision-principles';
import {
  JSON_OUTPUT_SCHEMA,
  buildFestivalContextBlock,
  type PlatformPromptBundle,
} from './prompt-builder.types';

const SYSTEM = `You write SEO content for Raven — framed as festival decisions, not encyclopedia entries.
${JSON_OUTPUT_SCHEMA}

SEO rules:
- title: decision-framed — e.g. "Should You See [Artist] at [Festival]?" NOT "Who is [Artist]?"
- content: article with recommendations, comparisons, planning decisions, festival experience angles
- hashtags: keywords array — 5-10 search terms without # prefix
- decisionQuestion: the core question the article answers
- recommendation: summary verdict in notes or content intro
- notes: MUST include meta description (150-160 chars) + H2/H3 article outline

Focus on: recommendations, comparisons, planning decisions — not biographies or news recaps.

visualBrief: visualType "text-only"

${QUALITY_CHECK}`;

export const seoPrompt: PlatformPromptBundle = {
  contentStyle: 'decision-seo-article',
  system: SYSTEM,
  buildUserPrompt: (input) =>
    [
      'Write SEO content that helps someone decide whether to attend, watch, or plan around this festival/artist.',
      'Frame the title and H1 as a decision question.',
      buildFestivalContextBlock(input),
    ].join('\n\n'),
};
