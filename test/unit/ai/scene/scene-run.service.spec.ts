import { BadRequestException } from '@nestjs/common';
import { SceneRunService } from '../../../../src/ai/scene/scene-run.service';
import { RecruitSearchSceneHandler } from '../../../../src/ai/scene/handlers/recruit-search.handler';

describe('SceneRunService', () => {
  const recruitHandler = {
    scene: 'recruit_search' as const,
    run: jest.fn(),
  };
  const service = new SceneRunService(
    recruitHandler as unknown as RecruitSearchSceneHandler,
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

  it('rejects unsupported scene', async () => {
    await expect(
      service.run({ scene: 'prep_nudge' }, {
        resolvedUserId: 'user-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
