import type { ContentSeries } from '../../content-series.types';
import type {
  SeriesGeneratorInput,
  SeriesPromptBundle,
} from '../prompt-builder.types';
import {
  DECISION_FRAMEWORK,
  QUALITY_CHECK,
  RAVEN_IDENTITY,
} from '../raven-decision-principles';
import { artistSpotlightPrompt } from './artist-spotlight.prompt';
import { communityDiscussionPrompt } from './community-discussion.prompt';
import { festivalIntelligencePrompt } from './festival-intelligence.prompt';
import { lineupBreakdownPrompt } from './lineup-breakdown.prompt';
import { travelGuidePrompt } from './travel-guide.prompt';

function buildDefaultSeriesPrompt(series: ContentSeries): SeriesPromptBundle {
  const labels: Record<ContentSeries, { label: string; purpose: string }> = {
    festival_guide: {
      label: 'Festival Guide',
      purpose: 'Help users decide how to approach and plan this festival',
    },
    travel_guide: {
      label: 'Travel Guide',
      purpose: 'Help users make travel decisions',
    },
    lineup_breakdown: {
      label: 'Lineup Guide',
      purpose: 'Help users decide who to prioritize on the lineup',
    },
    artist_spotlight: {
      label: 'Artist Guide',
      purpose: 'Help users decide if an artist matches their taste',
    },
    festival_intelligence: {
      label: 'Festival Intelligence',
      purpose: 'Help users make festival strategy decisions',
    },
    community_discussion: {
      label: 'Community Discussion',
      purpose: 'Spark conversations among festival fans',
    },
    budget_guide: {
      label: 'Budget Guide',
      purpose: 'Help users decide how to allocate festival budget',
    },
    packing_guide: {
      label: 'Packing Guide',
      purpose: 'Help users decide what to bring and prepare',
    },
    news_update: {
      label: 'News Update',
      purpose:
        'Frame lineup/news as decisions — what changed and what should fans do',
    },
  };

  const meta = labels[series];

  return {
    series,
    system: `${RAVEN_IDENTITY}

Content series: ${meta.label}
Purpose: ${meta.purpose}

${DECISION_FRAMEWORK}

Never generic tourism copy or encyclopedia tone.
Never invent lineup artists or dates not in festival data.

${QUALITY_CHECK}`,
    buildContextBlock: (input: SeriesGeneratorInput) => {
      const topicLine = input.topicHint?.trim()
        ? `Topic angle: ${input.topicHint.trim()}`
        : '';
      return [
        `=== CONTENT SERIES: ${meta.label} ===`,
        topicLine,
        `Focus: ${meta.purpose}`,
        'Populate decisionQuestion, recommendation, and targetAudience in JSON output.',
      ]
        .filter(Boolean)
        .join('\n');
    },
  };
}

const SERIES_PROMPTS: Partial<Record<ContentSeries, SeriesPromptBundle>> = {
  lineup_breakdown: lineupBreakdownPrompt,
  artist_spotlight: artistSpotlightPrompt,
  festival_intelligence: festivalIntelligencePrompt,
  travel_guide: travelGuidePrompt,
  community_discussion: communityDiscussionPrompt,
};

export function resolveSeriesPrompt(series: ContentSeries): SeriesPromptBundle {
  return SERIES_PROMPTS[series] ?? buildDefaultSeriesPrompt(series);
}
