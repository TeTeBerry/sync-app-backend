import {
  ANTI_PATTERNS,
  DECISION_FRAMEWORK,
  QUALITY_CHECK,
  RAVEN_IDENTITY,
} from '../raven-decision-principles';
import type { SeriesPromptBundle } from '../prompt-builder.types';

const SYSTEM = `${RAVEN_IDENTITY}

Content series: Artist Guide
Purpose: Help users decide whether an artist matches their taste at THIS festival.

Core question to answer: "Should I watch this artist at this festival?"

${DECISION_FRAMEWORK}

${ANTI_PATTERNS}

Do NOT create: Wikipedia biography, career timeline, generic facts.
DO create: experience description, who should watch, who should skip, honest recommendation.

Never invent tracks, biographical facts, or appearances not in artist data.

${QUALITY_CHECK}`;

export const artistSpotlightPrompt: SeriesPromptBundle = {
  series: 'artist_spotlight',
  system: SYSTEM,
  buildContextBlock: (input) => {
    const artistBlock = input.artistContext
      ? [
          'Artist context (JSON):',
          JSON.stringify(input.artistContext, null, 2),
        ].join('\n')
      : 'No artist profile loaded — use festival headline artists only.';

    const festivalName =
      typeof input.festival.name === 'string'
        ? input.festival.name
        : 'this festival';

    return [
      '=== CONTENT SERIES: Artist Guide ===',
      artistBlock,
      '',
      'Required decision metadata (populate JSON fields):',
      `- decisionQuestion: e.g. "Should [artist] be on your ${festivalName} schedule?"`,
      '- recommendation: clear yes/no/maybe with reason — e.g. "Prioritize if you want emotional peak-time visuals"',
      '- targetAudience: who should watch vs who should skip',
      '- hook: decision hook, not biography opener',
      '',
      'Instagram carousel (7 slides — populate carousel JSON):',
      'Slide 1: Artist + decision hook — e.g. "Should Anyma be on your Tomorrowland schedule?"',
      'Slide 2: Experience — sound, emotion, energy, crowd feeling (not career facts)',
      'Slide 3: Perfect for — sunset sets / emotional moments / peak-time energy / warehouse atmosphere',
      'Slide 4: If you like — recommend similar artists fans already know',
      'Slide 5: Essential tracks to listen before the festival',
      'Slide 6: Who should skip — be honest, e.g. "Skip if you prefer high BPM hard techno."',
      'Slide 7: Festival recommendation + soft Raven CTA',
      '',
      'Threads: discussion question or hot take — NOT a copy of the Instagram caption',
      'TikTok: 30-second decision script — hook, scenes, ending CTA',
      'SEO: title like "Should You See [Artist] at [Festival]?" — not "Who is [Artist]?"',
    ].join('\n');
  },
};
