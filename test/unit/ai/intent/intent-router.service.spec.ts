jest.mock('chromadb', () => require('../../../mocks/chromadb'));

jest.mock('@langchain/core/documents', () => require('../../../mocks/langchain-documents'));

jest.mock('@src/ai/llm/llm.service', () => ({
  LlmService: class MockLlmService {},
}));

jest.mock('@src/modules/activity/activity.service', () => ({
  ActivityService: class MockActivityService {},
}));

import { IntentRouterService } from '@src/ai/intent/intent-router.service';
import type { LlmService } from '@src/ai/llm/llm.service';
import type { ActivityService } from '@src/modules/activity/activity.service';

describe('IntentRouterService', () => {
  const activityService = {
    findByLegacyId: jest.fn(),
  } as unknown as ActivityService;

  const llmService = {
    enabled: true,
    invokeJson: jest.fn(),
  } as unknown as LlmService;

  let router: IntentRouterService;

  beforeEach(() => {
    jest.clearAllMocks();
    router = new IntentRouterService(llmService, activityService);
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
      messages: [{ role: 'user', content: '13号 A区 有人吗' }],
      input: '13号 A区 有人吗',
      activityLegacyId: 4,
      sessionId: 'sess-2',
      requestId: 'req-2',
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
