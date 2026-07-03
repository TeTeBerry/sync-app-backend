import { BadRequestException } from '@nestjs/common';
import { SceneRunService } from '../../../../src/ai/scene/scene-run.service';
import { EventsKnowledgeSearchSceneHandler } from '../../../../src/ai/scene/handlers/events-knowledge-search.handler';
import { FestivalStorySceneHandler } from '../../../../src/ai/scene/handlers/festival-story.handler';
import { LineupDjSceneHandler } from '../../../../src/ai/scene/handlers/lineup-dj.handler';

describe('SceneRunService', () => {
  const lineupDjHandler = {
    scene: 'lineup_dj' as const,
    run: jest.fn(),
  };
  const festivalStoryHandler = {
    scene: 'festival_story' as const,
    run: jest.fn(),
  };
  const eventsKnowledgeHandler = {
    scene: 'events_knowledge_search' as const,
    run: jest.fn(),
  };
  const service = new SceneRunService(
    lineupDjHandler as unknown as LineupDjSceneHandler,
    festivalStoryHandler as unknown as FestivalStorySceneHandler,
    eventsKnowledgeHandler as unknown as EventsKnowledgeSearchSceneHandler,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes events_knowledge_search to handler', async () => {
    eventsKnowledgeHandler.run.mockResolvedValue({ effects: [] });
    const request = {
      scene: 'events_knowledge_search' as const,
      input: '7月欧洲',
    };
    const actor = { resolvedUserId: 'user-1' } as never;

    await service.run(request, actor);

    expect(eventsKnowledgeHandler.run).toHaveBeenCalledWith(request, actor);
  });

  it('routes lineup_dj to handler', async () => {
    lineupDjHandler.run.mockResolvedValue({ effects: [] });
    const request = {
      scene: 'lineup_dj' as const,
      activityLegacyId: 8,
      context: { artistName: 'Charlotte de Witte' },
    };
    const actor = { resolvedUserId: 'user-1' } as never;

    await service.run(request, actor);

    expect(lineupDjHandler.run).toHaveBeenCalledWith(request, actor);
  });

  it('rejects unsupported scene', async () => {
    await expect(
      service.run({ scene: 'recruit_search' as never }, {
        resolvedUserId: 'user-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
