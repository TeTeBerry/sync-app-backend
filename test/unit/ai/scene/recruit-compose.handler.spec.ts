import { BadRequestException } from '@nestjs/common';
import { RecruitComposeSceneHandler } from '../../../../src/ai/scene/handlers/recruit-compose.handler';
import type { PostService } from '../../../../src/modules/partner/post.service';

describe('RecruitComposeSceneHandler', () => {
  const postService = {
    composeBuddyPostCandidates: jest.fn(),
  };

  const handler = new RecruitComposeSceneHandler(
    postService as unknown as PostService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns candidates effect and disclaimer', async () => {
    postService.composeBuddyPostCandidates.mockResolvedValue({
      candidates: [{ id: 'c1', text: '暗号：主舞台见', style: 'code' }],
      disclaimer: 'AI 生成，仅供参考',
      aiGenerated: true,
    });

    const result = await handler.run(
      {
        scene: 'recruit_compose',
        activityLegacyId: 8,
        context: {
          dateStart: '2026-05-15',
          dateEnd: '2026-05-17',
          location: '上海',
          headcount: '2',
          trigger: 'sheet_submit',
        },
      },
      { resolvedUserId: 'user-1' } as never,
    );

    expect(postService.composeBuddyPostCandidates).toHaveBeenCalledWith(
      expect.objectContaining({
        activityLegacyId: 8,
        location: '上海',
        headcount: '2',
      }),
      expect.anything(),
    );
    expect(result.effects).toEqual([
      {
        type: 'candidates',
        items: [{ id: 'c1', text: '暗号：主舞台见', style: 'code' }],
        aiGenerated: true,
      },
    ]);
    expect(result.disclaimer).toBe('AI 生成，仅供参考');
  });

  it('rejects missing compose context', async () => {
    await expect(
      handler.run({ scene: 'recruit_compose', activityLegacyId: 8 }, {
        resolvedUserId: 'user-1',
      } as never),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
