import { Test, TestingModule } from '@nestjs/testing';
import { RecruitApplyComposeSceneHandler } from '../../../../src/ai/scene/handlers/recruit-apply-compose.handler';
import { LlmService } from '../../../../src/infra/llm/llm.service';
import { UserService } from '../../../../src/modules/user/user.service';

describe('RecruitApplyComposeSceneHandler', () => {
  let handler: RecruitApplyComposeSceneHandler;
  let llmService: { invokeText: jest.Mock };

  beforeEach(async () => {
    llmService = { invokeText: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        RecruitApplyComposeSceneHandler,
        { provide: LlmService, useValue: llmService },
        { provide: UserService, useValue: { resolveProfile: jest.fn() } },
      ],
    }).compile();

    handler = module.get(RecruitApplyComposeSceneHandler);
  });

  it('returns candidates effect', async () => {
    llmService.invokeText.mockResolvedValue(
      '一起出发吧\n期待你的音乐品味\n求组队 🎵',
    );

    const response = await handler.run(
      {
        scene: 'recruit_apply_compose',
        activityLegacyId: 8,
        context: {
          postId: 'post-1',
          applicantName: 'Berry',
          trigger: 'sheet_submit',
        },
      },
      { resolvedUserId: 'user-1' } as never,
    );

    expect(response.effects).toHaveLength(1);
    expect(response.effects[0].type).toBe('candidates');
    expect(llmService.invokeText.mock.calls[0][0]).toContain('简体中文');
    expect(llmService.invokeText.mock.calls[0][1]).toContain('招募帖摘要');
  });

  it('returns fallback when LLM fails', async () => {
    llmService.invokeText.mockResolvedValue(null);

    const response = await handler.run(
      {
        scene: 'recruit_apply_compose',
        activityLegacyId: 8,
        context: { postId: 'post-1', trigger: 'sheet_submit' },
      },
      { resolvedUserId: 'user-1' } as never,
    );

    const candidates = response.effects[0] as { items: unknown[] };
    expect(candidates.items.length).toBeGreaterThan(0);
  });
});
