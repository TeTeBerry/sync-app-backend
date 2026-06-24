import { Document } from '@langchain/core/documents';
import { shouldUseLlmKnowledgeCard } from '../../../../src/modules/activity/utils/events-knowledge-llm-gate.util';
import type { ActivityLookupRecord } from '../../../../src/modules/activity/ports/activity-lookup.port';

function activity(
  partial: Partial<ActivityLookupRecord> &
    Pick<ActivityLookupRecord, 'legacyId' | 'name' | 'code'>,
): ActivityLookupRecord {
  return {
    alias: [],
    hot: false,
    attendees: 0,
    activityType: 'festival',
    ...partial,
  } as ActivityLookupRecord;
}

describe('shouldUseLlmKnowledgeCard', () => {
  it('skips LLM for simple month + region filters with matches', () => {
    expect(
      shouldUseLlmKnowledgeCard({
        query: '7月欧洲',
        parsed: { month: 7, region: 'europe', intent: 'discover' },
        matchedActivities: [
          activity({ legacyId: 3, name: 'Ultra', code: 'ultra-europe' }),
        ],
        chromaDocs: [],
      }),
    ).toBe(false);
  });

  it('uses LLM for open questions', () => {
    expect(
      shouldUseLlmKnowledgeCard({
        query: '7月欧洲 techno 哪些值得去？',
        parsed: {
          month: 7,
          region: 'europe',
          genre: 'Techno',
          intent: 'discover',
        },
        matchedActivities: [
          activity({ legacyId: 3, name: 'Ultra', code: 'ultra-europe' }),
        ],
        chromaDocs: [],
      }),
    ).toBe(true);
  });

  it('uses LLM when chroma hits but catalog match is empty', () => {
    expect(
      shouldUseLlmKnowledgeCard({
        query: '仁川 edc 签证',
        parsed: { intent: 'travel' },
        matchedActivities: [],
        chromaDocs: [
          new Document({
            pageContent: 'EDC Korea visa hint',
            metadata: { topic: 'activity', code: 'edc-korea' },
          }),
        ],
      }),
    ).toBe(true);
  });

  it('skips LLM for compare intent (dedicated intro path)', () => {
    expect(
      shouldUseLlmKnowledgeCard({
        query: 'storm vs ultra',
        parsed: { intent: 'compare' },
        matchedActivities: [
          activity({ legacyId: 1, name: 'Storm', code: 'storm' }),
          activity({ legacyId: 3, name: 'Ultra', code: 'ultra-europe' }),
        ],
        chromaDocs: [],
      }),
    ).toBe(false);
  });

  it('skips LLM for festival lineup lookup with matched activities', () => {
    expect(
      shouldUseLlmKnowledgeCard({
        query: '泰国edc阵容',
        parsed: { intent: 'discover', area: '泰国', keywords: ['edc'] },
        matchedActivities: [
          activity({
            legacyId: 5,
            name: 'EDC Thailand 2026',
            code: 'edc-thailand',
          }),
        ],
        chromaDocs: [],
      }),
    ).toBe(false);
  });
});
