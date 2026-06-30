import { BadRequestException } from '@nestjs/common';
import { SceneRunService } from '../../../../src/ai/scene/scene-run.service';
import { EventsKnowledgeSearchSceneHandler } from '../../../../src/ai/scene/handlers/events-knowledge-search.handler';
import { FestivalStorySceneHandler } from '../../../../src/ai/scene/handlers/festival-story.handler';
import { LineupDjSceneHandler } from '../../../../src/ai/scene/handlers/lineup-dj.handler';
import { RecruitApplyComposeSceneHandler } from '../../../../src/ai/scene/handlers/recruit-apply-compose.handler';
import { RecruitComposeSceneHandler } from '../../../../src/ai/scene/handlers/recruit-compose.handler';
import { RecruitSearchSceneHandler } from '../../../../src/ai/scene/handlers/recruit-search.handler';

describe('SceneRunService', () => {
  const recruitHandler = {
    scene: 'recruit_search' as const,
    run: jest.fn(),
  };
  const recruitComposeHandler = {
    scene: 'recruit_compose' as const,
    run: jest.fn(),
  };
  const recruitApplyComposeHandler = {
    scene: 'recruit_apply_compose' as const,
    run: jest.fn(),
  };
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
    recruitHandler as unknown as RecruitSearchSceneHandler,
    recruitComposeHandler as unknown as RecruitComposeSceneHandler,
    recruitApplyComposeHandler as unknown as RecruitApplyComposeSceneHandler,
    lineupDjHandler as unknown as LineupDjSceneHandler,
    festivalStoryHandler as unknown as FestivalStorySceneHandler,
    eventsKnowledgeHandler as unknown as EventsKnowledgeSearchSceneHandler,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('routes recruit_search to handler', async () => {
    recruitHandler.run.mockResolvedValue({ effects: [] });
    const request = {
      scene: 'recruit_search' as const,
      input: '上海 techno',
      activityLegacyId: 8,
    };
    const actor = { resolvedUserId: 'user-1' } as never;

    await service.run(request, actor);

    expect(recruitHandler.run).toHaveBeenCalledWith(request, actor);
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

  it('routes recruit_compose to handler', async () => {
    recruitComposeHandler.run.mockResolvedValue({ effects: [] });
    const request = {
      scene: 'recruit_compose' as const,
      activityLegacyId: 8,
      context: {
        dateStart: '2026-05-15',
        dateEnd: '2026-05-17',
        location: '上海',
        headcount: '2',
      },
    };
    const actor = { resolvedUserId: 'user-1' } as never;

    await service.run(request, actor);

    expect(recruitComposeHandler.run).toHaveBeenCalledWith(request, actor);
  });

  it('rejects unsupported scene', async () => {
    await expect(
      service.run({ scene: 'prep_nudge' }, {
        resolvedUserId: 'user-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
