import { ConfigService } from '@nestjs/config';
import { TextLlmClient } from '@src/infra/llm/text-llm.client';

function mockConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('TextLlmClient', () => {
  it('uses hunyuan when HUNYUAN_API_KEY is configured', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': 'hy-key',
        'hunyuan.baseUrl': 'https://tokenhub.tencentmaas.com/v1',
        'hunyuan.textModel': 'hy3-preview',
        'hunyuan.reasoningEffort': 'no_think',
        'ai.agent.model': '',
      }),
    );

    expect(client.provider).toBe('hunyuan');
    expect(client.enabled).toBe(true);
    expect(client.jsonModel).toBe('hy3-preview');
    expect(client.resolveAgentModel()).toBe('hy3-preview');
  });

  it('prefers AI_AGENT_MODEL over hunyuan.textModel', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': 'hy-key',
        'hunyuan.textModel': 'hy3-preview',
        'hunyuan.reasoningEffort': 'no_think',
        'ai.agent.model': 'custom-model',
      }),
    );

    expect(client.resolveAgentModel()).toBe('custom-model');
  });

  it('allows per-request reasoningEffort override', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"ok":true}' } }],
      }),
    });
    global.fetch = fetchMock as typeof fetch;

    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': 'hy-key',
        'hunyuan.textModel': 'hy3-preview',
        'hunyuan.reasoningEffort': 'no_think',
      }),
    );

    await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      reasoningEffort: 'high',
    });

    const body = JSON.parse(
      String(fetchMock.mock.calls[0]?.[1]?.body ?? '{}'),
    ) as {
      extra_body?: { chat_template_kwargs?: { reasoning_effort?: string } };
    };
    expect(body.extra_body?.chat_template_kwargs?.reasoning_effort).toBe(
      'high',
    );
  });

  it('is disabled when HUNYUAN_API_KEY is missing', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': '',
      }),
    );

    expect(client.provider).toBe('none');
    expect(client.enabled).toBe(false);
  });
});
