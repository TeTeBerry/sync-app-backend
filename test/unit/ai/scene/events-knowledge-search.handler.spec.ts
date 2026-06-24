import { BadRequestException } from '@nestjs/common';
import { EventsKnowledgeSearchSceneHandler } from '../../../../src/ai/scene/handlers/events-knowledge-search.handler';
import type { EventsKnowledgeSearchService } from '../../../../src/modules/activity/application/events-knowledge-search.service';

describe('EventsKnowledgeSearchSceneHandler', () => {
  const eventsKnowledgeSearch = {
    search: jest.fn(),
  };
  const handler = new EventsKnowledgeSearchSceneHandler(
    eventsKnowledgeSearch as unknown as EventsKnowledgeSearchService,
  );
  const actor = { resolvedUserId: 'user-1' } as never;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requires input', async () => {
    await expect(
      handler.run({ scene: 'events_knowledge_search', input: '  ' }, actor),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('maps search result to scene effects', async () => {
    eventsKnowledgeSearch.search.mockResolvedValue({
      parsed: { month: 7, region: 'europe', intent: 'discover' },
      parsedSummary: '欧洲 · 7月',
      matchedActivities: [{ legacyId: 3, name: 'Ultra Europe 2026' }],
      knowledgeCard: {
        title: '电音节资讯',
        sections: [{ body: '找到 1 场相关电音节。' }],
        sources: ['SYNC 活动库'],
        aiGenerated: false,
      },
    });

    const response = await handler.run(
      {
        scene: 'events_knowledge_search',
        input: '7月欧洲',
        context: { locale: 'zh-CN', trigger: 'search' },
      },
      actor,
    );

    expect(eventsKnowledgeSearch.search).toHaveBeenCalledWith(
      '7月欧洲',
      'zh-CN',
    );
    expect(response.effects).toEqual(
      expect.arrayContaining([
        {
          type: 'insight_line',
          text: '欧洲 · 7月',
          variant: 'knowledge',
          aiGenerated: false,
        },
        {
          type: 'knowledge_card',
          card: expect.objectContaining({
            title: '电音节资讯',
            links: [
              {
                label: 'Ultra Europe 2026',
                activityLegacyId: 3,
              },
            ],
          }),
        },
        {
          type: 'filter_activities',
          activityLegacyIds: [3],
          totalMatched: 1,
          parsed: expect.objectContaining({ month: 7 }),
        },
      ]),
    );
    expect(response.disclaimer).toContain('不卖票');
  });
});
