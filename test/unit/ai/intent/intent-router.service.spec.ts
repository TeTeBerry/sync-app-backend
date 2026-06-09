jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () =>
  require('../../../mocks/langchain-documents'),
);

jest.mock('@src/ai/llm/llm.service', () => ({
  LlmService: class MockLlmService {},
}));

jest.mock('@src/modules/activity/activity.service', () => ({
  ActivityService: class MockActivityService {},
}));

import { IntentCacheService } from '@src/ai/intent/intent-cache.service';
import { IntentRouterService } from '@src/ai/intent/intent-router.service';
import * as intentRouterRules from '@src/ai/intent/intent-router.rules';
import type { LlmService } from '@src/ai/llm/llm.service';
import type { ActivityService } from '@src/modules/activity/activity.service';
import { RedisService } from '@src/redis/redis.service';
import { ConfigService } from '@nestjs/config';

describe('IntentRouterService', () => {
  const activityService = {
    findByLegacyId: jest.fn(),
  } as unknown as ActivityService;

  const llmService = {
    enabled: true,
    invokeJson: jest.fn(),
  } as unknown as LlmService;

  const redisService = {
    getCacheValue: jest.fn().mockResolvedValue(null),
    setCacheValueEx: jest.fn().mockResolvedValue(undefined),
  } as unknown as RedisService;

  let policySkipLlm = false;
  let agentMode = 'off';

  const configService = {
    get: jest.fn((key: string) => {
      if (key === 'ai.intentCache.ttlMs') return 30_000;
      if (key === 'ai.intentCache.maxMemoryEntries') return 1000;
      if (key === 'ai.intent.skipLlmReadonly') return policySkipLlm;
      if (key === 'ai.agent.mode') return agentMode;
      return undefined;
    }),
  } as unknown as ConfigService;

  let intentCache: IntentCacheService;
  let router: IntentRouterService;

  beforeEach(() => {
    jest.clearAllMocks();
    policySkipLlm = false;
    agentMode = 'off';
    intentCache = new IntentCacheService(redisService, configService);
    router = new IntentRouterService(
      llmService,
      activityService,
      intentCache,
      configService,
    );
  });

  it('uses rule fast path without calling LLM', async () => {
    const result = await router.resolve({
      messages: [],
      input: '确认发布',
      sessionId: 'sess-1',
      requestId: 'req-1',
    });

    expect(result).toEqual({ kind: 'create_post', source: 'rule' });
    expect(llmService.invokeJson).not.toHaveBeenCalled();
  });

  it('uses LLM for dj_info when rules miss', async () => {
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'dj_info',
    });

    const result = await router.resolve({
      messages: [
        { role: 'user', content: 'Marshmello' },
        { role: 'assistant', content: '想了解近期演出还是类似艺人？' },
      ],
      input: '近期演出',
      activityLegacyId: 5,
      sessionId: 'sess-dj',
      requestId: 'req-dj',
    });

    expect(llmService.invokeJson).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'dj_info', source: 'llm' });
  });

  it('uses LLM for performance follow-up with context', async () => {
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'dj_info',
    });

    const result = await router.resolve({
      messages: [
        { role: 'user', content: 'Marshmello' },
        { role: 'assistant', content: '想了解近期演出还是类似艺人？' },
      ],
      input: '近期演出',
      sessionId: 'sess-dj-perf',
      requestId: 'req-dj-perf',
    });

    expect(llmService.invokeJson).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'dj_info', source: 'llm' });
  });

  it('uses rule fast path for similar-style DJ follow-up', async () => {
    const result = await router.resolve({
      messages: [
        { role: 'user', content: 'Marshmello 什么风格' },
        { role: 'assistant', content: 'Marshmello 以 Future Bass 为主。' },
      ],
      input: '帮我找类似风格的DJ',
      activityLegacyId: 4,
      sessionId: 'sess-dj-follow',
      requestId: 'req-dj-follow',
    });

    expect(llmService.invokeJson).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'dj_info', source: 'rule' });
  });

  it('uses rule fast path for zone buddy search when activity is bound', async () => {
    const result = await router.resolve({
      messages: [{ role: 'user', content: '13号 A区 有人吗' }],
      input: '13号 A区 有人吗',
      activityLegacyId: 4,
      sessionId: 'sess-2',
      requestId: 'req-2',
    });

    expect(llmService.invokeJson).not.toHaveBeenCalled();
    expect(result.kind).toBe('search_posts');
    expect(result.source).toBe('rule');
    expect(result.buddySearchHint?.displayLabel).toBe('13号 A区 有人吗');
  });

  it('calls mocked LLM when rules miss and maps search_posts', async () => {
    (activityService.findByLegacyId as jest.Mock).mockResolvedValue({
      legacyId: 4,
      name: '风暴电音节',
      date: '06/13-14',
    });
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'search_posts',
      searchHint: '13号A区',
    });

    const result = await router.resolve({
      messages: [{ role: 'user', content: '13号 A区' }],
      input: '13号 A区',
      activityLegacyId: 4,
      sessionId: 'sess-2-llm',
      requestId: 'req-2-llm',
    });

    expect(llmService.invokeJson).toHaveBeenCalledTimes(1);
    expect(result.kind).toBe('search_posts');
    expect(result.source).toBe('llm');
    expect(result.buddySearchHint?.displayLabel).toBe('13号A区');
  });

  it('returns cached intent for same session+input within TTL', async () => {
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'create_post',
    });

    const params = {
      messages: [],
      input: '我想交个朋友聊聊天',
      sessionId: 'sess-cache',
      requestId: 'req-cache',
    };

    const first = await router.resolve(params);
    const second = await router.resolve(params);

    expect(first).toEqual(second);
    expect(llmService.invokeJson).toHaveBeenCalledTimes(1);
  });

  it('does not share cache across different activityLegacyId', async () => {
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'create_post',
    });

    const base = {
      messages: [],
      input: '有人吗',
      sessionId: 'sess-act',
      requestId: 'req-act',
    };

    await router.resolve({ ...base, activityLegacyId: 4 });
    await router.resolve({ ...base, activityLegacyId: 9 });

    expect(llmService.invokeJson).toHaveBeenCalledTimes(2);
  });

  it('maps LLM dj_info intent', async () => {
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'dj_info',
    });

    const result = await router.resolve({
      messages: [],
      input: '我想交个朋友聊聊天',
      sessionId: 'sess-dj-llm',
      requestId: 'req-dj-llm',
    });

    expect(result).toEqual({ kind: 'dj_info', source: 'llm' });
  });

  it('maps LLM chitchat to quick_reply instead of create_post', async () => {
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'chitchat',
    });

    const result = await router.resolve({
      messages: [],
      input: '你好',
      sessionId: 'sess-chitchat',
      requestId: 'req-chitchat',
    });

    expect(result).toEqual({ kind: 'quick_reply', source: 'llm' });
  });

  it('uses rule fast path for dj_info without calling LLM', async () => {
    const result = await router.resolve({
      messages: [],
      input: 'Marshmello 是什么风格',
      activityLegacyId: 5,
      sessionId: 'sess-dj-rule',
      requestId: 'req-dj-rule',
    });

    expect(result).toEqual({ kind: 'dj_info', source: 'rule' });
    expect(llmService.invokeJson).not.toHaveBeenCalled();
  });

  it('skips Intent LLM for read-only turns when agent mode is on', async () => {
    policySkipLlm = true;
    agentMode = 'on';
    const fastPathSpy = jest
      .spyOn(intentRouterRules, 'resolveChatIntentFastPath')
      .mockReturnValue(null);

    const result = await router.resolve({
      messages: [],
      input: 'Marshmello 是什么风格',
      activityLegacyId: 5,
      sessionId: 'sess-policy',
      requestId: 'req-policy',
    });

    expect(llmService.invokeJson).not.toHaveBeenCalled();
    expect(result).toEqual({ kind: 'dj_info', source: 'policy' });

    fastPathSpy.mockRestore();
  });

  it('still calls Intent LLM when skip-readonly policy is disabled', async () => {
    policySkipLlm = false;
    agentMode = 'on';
    const fastPathSpy = jest
      .spyOn(intentRouterRules, 'resolveChatIntentFastPath')
      .mockReturnValue(null);
    (llmService.invokeJson as jest.Mock).mockResolvedValue({
      intent: 'dj_info',
    });

    const result = await router.resolve({
      messages: [],
      input: 'Marshmello 是什么风格',
      activityLegacyId: 5,
      sessionId: 'sess-policy-off',
      requestId: 'req-policy-off',
    });

    expect(llmService.invokeJson).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ kind: 'dj_info', source: 'llm' });

    fastPathSpy.mockRestore();
  });

  it('falls back to create_post when LLM is disabled', async () => {
    (llmService as { enabled: boolean }).enabled = false;

    const result = await router.resolve({
      messages: [],
      input: '我想交个朋友聊聊天',
      sessionId: 'sess-3',
      requestId: 'req-3',
    });

    expect(result).toEqual({ kind: 'create_post', source: 'default' });
    expect(llmService.invokeJson).not.toHaveBeenCalled();

    (llmService as { enabled: boolean }).enabled = true;
  });
});
