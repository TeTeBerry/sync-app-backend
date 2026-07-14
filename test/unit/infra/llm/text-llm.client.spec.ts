import { ConfigService } from '@nestjs/config';
import { TextLlmClient } from '@src/infra/llm/text-llm.client';
import {
  buildCloudbaseInitOptions,
  hasCloudbaseAuth,
} from '@src/infra/llm/cloudbase-app.util';

const generateText = jest.fn();
const createModel = jest.fn(() => ({ generateText }));
const ai = jest.fn(() => ({ createModel }));
const init = jest.fn(() => ({ ai }));

jest.mock('@cloudbase/node-sdk', () => ({
  __esModule: true,
  init,
  default: { init },
}));

function mockConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: (key: string) => values[key],
  } as unknown as ConfigService;
}

describe('cloudbase-app.util', () => {
  it('prefers secretId/secretKey per official standalone Node docs', () => {
    expect(
      buildCloudbaseInitOptions({
        envId: 'sync-prd-xxx',
        secretId: 'sid',
        secretKey: 'skey',
        accessKey: 'ak',
        timeoutMs: 60_000,
      }),
    ).toEqual({
      env: 'sync-prd-xxx',
      timeout: 60_000,
      secretId: 'sid',
      secretKey: 'skey',
    });
  });

  it('falls back to accessKey when secrets are missing', () => {
    expect(
      buildCloudbaseInitOptions({
        envId: 'sync-prd-xxx',
        accessKey: 'ak',
      }),
    ).toEqual({
      env: 'sync-prd-xxx',
      timeout: 60_000,
      accessKey: 'ak',
    });
  });

  it('enforces docs minimum timeout of 60000', () => {
    expect(
      buildCloudbaseInitOptions({
        envId: 'sync-prd-xxx',
        accessKey: 'ak',
        timeoutMs: 10_000,
      })?.timeout,
    ).toBe(60_000);
  });

  it('hasCloudbaseAuth requires env + credentials', () => {
    expect(hasCloudbaseAuth({ envId: '', accessKey: 'ak' })).toBe(false);
    expect(
      hasCloudbaseAuth({ envId: 'env', secretId: 'a', secretKey: 'b' }),
    ).toBe(true);
  });
});

describe('TextLlmClient', () => {
  beforeEach(() => {
    generateText.mockReset();
    createModel.mockClear();
    ai.mockClear();
    init.mockClear();
    generateText.mockResolvedValue({
      text: '{"ok":true}',
      messages: [{ role: 'assistant', content: '{"ok":true}' }],
    });
  });

  it('uses cloudbase with secretId/secretKey (docs standalone Node)', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.textModel': 'hy3',
        'hunyuan.reasoningEffort': 'no_think',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.secretId': 'sid',
        'cloudbase.secretKey': 'skey',
        'ai.agent.model': '',
      }),
    );

    expect(client.provider).toBe('cloudbase');
    expect(client.enabled).toBe(true);
    expect(client.jsonModel).toBe('hy3');
  });

  it('uses cloudbase when env + api key are configured', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': 'hy-key',
        'hunyuan.textModel': 'hy3',
        'hunyuan.reasoningEffort': 'no_think',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.apiKey': 'hy-key',
        'ai.agent.model': '',
      }),
    );

    expect(client.provider).toBe('cloudbase');
    expect(client.enabled).toBe(true);
    expect(client.resolveAgentModel()).toBe('hy3');
  });

  it('prefers AI_AGENT_MODEL over hunyuan.textModel', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': 'hy-key',
        'hunyuan.textModel': 'hy3',
        'hunyuan.reasoningEffort': 'no_think',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.apiKey': 'hy-key',
        'ai.agent.model': 'custom-model',
      }),
    );

    expect(client.resolveAgentModel()).toBe('custom-model');
  });

  it('inits with secretId/secretKey and calls generateText(hy3)', async () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.textModel': 'hy3',
        'hunyuan.reasoningEffort': 'no_think',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.secretId': 'sid',
        'cloudbase.secretKey': 'skey',
        'cloudbase.apiKey': 'should-not-win',
      }),
    );

    const result = await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
    });

    expect(init).toHaveBeenCalledWith({
      env: 'sync-prd-xxx',
      timeout: 120_000,
      secretId: 'sid',
      secretKey: 'skey',
    });
    expect(createModel).toHaveBeenCalledWith('cloudbase');
    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'hy3',
        temperature: 0.1,
        messages: [{ role: 'user', content: 'hi' }],
      }),
      expect.objectContaining({ timeout: 60_000 }),
    );
    expect(result?.choices?.[0]?.message?.content).toBe('{"ok":true}');
  });

  it('forwards non-default reasoningEffort on CloudBase', async () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': 'hy-key',
        'hunyuan.textModel': 'hy3',
        'hunyuan.reasoningEffort': 'no_think',
        'cloudbase.envId': 'sync-prd-xxx',
        'cloudbase.apiKey': 'hy-key',
      }),
    );

    await client.chat({
      messages: [{ role: 'user', content: 'hi' }],
      reasoningEffort: 'high',
    });

    expect(generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        extra_body: {
          chat_template_kwargs: { reasoning_effort: 'high' },
        },
      }),
      expect.any(Object),
    );
  });

  it('is disabled when CloudBase credentials are missing', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': '',
        'cloudbase.envId': '',
        'cloudbase.apiKey': '',
      }),
    );

    expect(client.provider).toBe('none');
    expect(client.enabled).toBe(false);
  });

  it('is disabled when only HUNYUAN_API_KEY is set without CLOUDBASE_ENV_ID', () => {
    const client = new TextLlmClient(
      mockConfig({
        'hunyuan.apiKey': 'hy-key',
        'cloudbase.envId': '',
      }),
    );

    expect(client.provider).toBe('none');
    expect(client.enabled).toBe(false);
  });
});
