jest.mock('@src/ai/llm/llm.service', () => ({
  LlmService: jest.fn(),
}));

import { RiskAgent } from '@src/ai/agents/risk.agent';

describe('RiskAgent rules-only shortcut path', () => {
  const invokeJson = jest.fn();
  const existsOwnerRecruitingPostForActivity = jest
    .fn()
    .mockResolvedValue(false);
  const existsDuplicateBody = jest.fn().mockResolvedValue(false);

  const agent = new RiskAgent(
    { invokeJson } as never,
    {
      existsOwnerRecruitingPostForActivity,
      existsDuplicateBody,
    } as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('skips LLM when rulesOnly and duplicate checks pass', async () => {
    const result = await agent.assess(
      {
        body: '找风暴电音节同行，6月13日上海出发，2人',
        userId: 'user-1',
        activityLegacyId: 9,
      },
      { rulesOnly: true },
    );

    expect(result.publishable).toBe(true);
    expect(result.sanitizedBody).toContain('风暴电音节');
    expect(invokeJson).not.toHaveBeenCalled();
  });

  it('still rejects duplicate posts when rulesOnly', async () => {
    existsDuplicateBody.mockResolvedValueOnce(true);

    const result = await agent.assess(
      {
        body: '重复内容',
        userId: 'user-1',
        activityLegacyId: 9,
      },
      { rulesOnly: true },
    );

    expect(result.publishable).toBe(false);
    expect(result.violationType).toBe('duplicate');
    expect(invokeJson).not.toHaveBeenCalled();
  });

  it('still rejects rule violations when rulesOnly', async () => {
    const result = await agent.assess(
      {
        body: '加微信 wx123456 私聊',
        userId: 'user-1',
        activityLegacyId: 9,
      },
      { rulesOnly: true },
    );

    expect(result.publishable).toBe(false);
    expect(invokeJson).not.toHaveBeenCalled();
  });
});
