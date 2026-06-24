import { BuddyPostComposeService } from '@src/modules/partner/application/buddy-post-compose.service';
import { LlmService } from '@src/infra/llm/llm.service';
import { UserService } from '@src/modules/user/user.service';
import { WechatContentSecurityService } from '@src/modules/auth/wechat-content-security.service';
import type { AiComposePostsDto } from '@src/modules/partner/dto/ai-compose-posts.dto';

describe('BuddyPostComposeService', () => {
  const llmService = {
    enabled: true,
    invokeJson: jest.fn(),
  };
  const wechatContentSecurity = {
    assertTextsSafe: jest.fn().mockResolvedValue(undefined),
  };
  const userService = {
    resolveProfile: jest.fn().mockResolvedValue({ favorGenres: ['Techno'] }),
  };
  const activityLookup = {
    findByLegacyId: jest.fn().mockResolvedValue({ name: 'EDC Korea' }),
  };

  let service: BuddyPostComposeService;

  const baseDto: AiComposePostsDto = {
    activityLegacyId: 8,
    dateStart: '2026-05-15',
    dateEnd: '2026-05-17',
    location: '上海',
    headcount: '2',
    composeHints: {
      personalityType: 'frontline',
      setPicks: ['Martin Garrix'],
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new BuddyPostComposeService(
      llmService as unknown as LlmService,
      wechatContentSecurity as unknown as WechatContentSecurityService,
      userService as unknown as UserService,
      activityLookup as never,
    );
  });

  it('returns moderated LLM candidates with disclaimer', async () => {
    llmService.invokeJson.mockResolvedValue({
      candidates: [
        { text: '暗号：主舞台见', style: 'code' },
        { text: '口号：Techno 小队', style: 'slogan' },
        { text: '接头语：上海出发', style: 'code' },
      ],
    });

    const result = await service.compose(baseDto, {
      resolvedUserId: 'u1',
    } as never);

    expect(result.aiGenerated).toBe(true);
    expect(result.disclaimer).toBe('AI 生成，仅供参考');
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.text).toBe('暗号：主舞台见');
    expect(userService.resolveProfile).toHaveBeenCalled();
  });

  it('filters candidates with contact info', async () => {
    llmService.invokeJson.mockResolvedValue({
      candidates: [
        { text: '联系 13800138000' },
        { text: '暗号：主舞台见', style: 'code' },
        { text: '口号：Techno 小队', style: 'slogan' },
        { text: '接头语：上海出发', style: 'code' },
      ],
    });

    const result = await service.compose(baseDto, {
      resolvedUserId: 'u1',
    } as never);

    expect(result.candidates.map((item) => item.text)).not.toContain(
      '联系 13800138000',
    );
    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
  });

  it('falls back to rule-based candidates when LLM is disabled', async () => {
    llmService.enabled = false;

    const result = await service.compose({ ...baseDto, regenerate: true }, {
      resolvedUserId: 'u1',
    } as never);

    expect(llmService.invokeJson).not.toHaveBeenCalled();
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates[0]?.text).toContain('暗号');

    llmService.enabled = true;
  });

  it('merges profile favorGenres into compose hints', async () => {
    llmService.invokeJson.mockResolvedValue({
      candidates: [
        { text: '暗号：主舞台见', style: 'code' },
        { text: '口号：Techno 小队', style: 'slogan' },
        { text: '接头语：上海出发', style: 'code' },
      ],
    });

    await service.compose(baseDto, { resolvedUserId: 'u1' } as never);

    const userPrompt = String(llmService.invokeJson.mock.calls[0]?.[1] ?? '');
    expect(userPrompt).toContain('偏好曲风：Techno');
  });
});
