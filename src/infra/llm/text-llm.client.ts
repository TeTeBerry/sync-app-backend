/**
 * Text LLM via CloudBase AI only (`@cloudbase/node-sdk`).
 * @see https://docs.cloudbase.net/ai/model/nodejs-access#%E5%88%9D%E5%A7%8B%E5%8C%96
 *
 * Vision uses QWEN_API_KEY in LlmService.invokeVisionJson. See docs/LLM.md.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  buildCloudbaseInitOptions,
  hasCloudbaseAuth,
} from './cloudbase-app.util';
import type {
  OpenAiChatCompletionResponse,
  OpenAiChatMessageInput,
} from './openai-chat.types';

/** CloudBase AI+ text, or disabled when env/credentials are missing. */
export type TextLlmProvider = 'cloudbase' | 'none';

/** Hunyuan hy3 `chat_template_kwargs.reasoning_effort` */
export type HunyuanReasoningEffort = 'no_think' | 'low' | 'high';

/** Docs default text model for `createModel("cloudbase")`. */
export const CLOUDBASE_DEFAULT_TEXT_MODEL = 'hy3';

/** Docs recommend ≥ 60s; travel-guide JSON often needs more. */
const CLOUDBASE_INIT_TIMEOUT_MS = 120_000;

type ChatParams = {
  messages: OpenAiChatMessageInput[];
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  /** Overrides `HUNYUAN_REASONING_EFFORT` for this request. */
  reasoningEffort?: HunyuanReasoningEffort;
  tools?: Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
  toolChoice?: 'auto' | 'none';
};

type CloudbaseChatModel = {
  generateText: (
    input: Record<string, unknown>,
    options?: { timeout?: number },
  ) => Promise<{
    text?: string;
    messages?: Array<Record<string, unknown>>;
    error?: unknown;
  }>;
};

@Injectable()
export class TextLlmClient {
  private readonly logger = new Logger(TextLlmClient.name);
  readonly provider: TextLlmProvider;
  readonly enabled: boolean;
  readonly jsonModel: string;

  private readonly reasoningEffort: string;
  private readonly cloudbaseEnvId: string;
  private readonly cloudbaseAccessKey: string;
  private readonly cloudbaseSecretId: string;
  private readonly cloudbaseSecretKey: string;
  private cloudbaseModel: CloudbaseChatModel | null = null;
  private cloudbaseInitPromise: Promise<CloudbaseChatModel | null> | null =
    null;

  constructor(private readonly config: ConfigService) {
    this.reasoningEffort =
      this.config.get<string>('hunyuan.reasoningEffort') ?? 'no_think';
    this.jsonModel =
      this.config.get<string>('hunyuan.textModel') ??
      CLOUDBASE_DEFAULT_TEXT_MODEL;

    this.cloudbaseEnvId =
      this.config.get<string>('cloudbase.envId')?.trim() ?? '';
    this.cloudbaseAccessKey =
      this.config.get<string>('cloudbase.apiKey')?.trim() ||
      this.config.get<string>('hunyuan.apiKey')?.trim() ||
      '';
    this.cloudbaseSecretId =
      this.config.get<string>('cloudbase.secretId')?.trim() ?? '';
    this.cloudbaseSecretKey =
      this.config.get<string>('cloudbase.secretKey')?.trim() ?? '';

    const canUseCloudbase = hasCloudbaseAuth({
      envId: this.cloudbaseEnvId,
      secretId: this.cloudbaseSecretId,
      secretKey: this.cloudbaseSecretKey,
      accessKey: this.cloudbaseAccessKey,
    });

    if (canUseCloudbase) {
      this.provider = 'cloudbase';
    } else {
      this.provider = 'none';
      this.logger.warn(
        'Text LLM disabled: set CLOUDBASE_ENV_ID and TENCENTCLOUD_SECRETID/SECRETKEY (or HUNYUAN_API_KEY / CLOUDBASE_APIKEY)',
      );
    }

    this.enabled = this.provider === 'cloudbase';

    this.logger.log(
      `Text LLM provider=${this.provider} model=${this.jsonModel} enabled=${this.enabled}`,
    );
  }

  resolveAgentModel(): string {
    const configured = this.config.get<string>('ai.agent.model')?.trim();
    return configured || this.jsonModel;
  }

  async chat(params: ChatParams): Promise<OpenAiChatCompletionResponse | null> {
    if (!this.enabled) {
      return null;
    }

    const started = Date.now();
    const model = params.model ?? this.jsonModel;
    try {
      const result = await this.chatViaCloudbase(params);
      this.logger.log(
        `Text LLM chat ok provider=cloudbase model=${model} ms=${Date.now() - started}`,
      );
      return result;
    } catch (error) {
      this.logger.warn(
        `Text LLM chat failed provider=cloudbase model=${model} ms=${Date.now() - started}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  extractAssistantText(data: OpenAiChatCompletionResponse | null): string {
    const message = data?.choices?.[0]?.message;
    const content = message?.content;
    if (typeof content === 'string') {
      return content.trim();
    }
    return '';
  }

  private async chatViaCloudbase(
    params: ChatParams,
  ): Promise<OpenAiChatCompletionResponse | null> {
    try {
      const model = await this.getCloudbaseModel();
      if (!model) {
        return null;
      }

      // Official shape: createModel("cloudbase").generateText({ model, messages })
      const input: Record<string, unknown> = {
        model: params.model ?? this.jsonModel,
        messages: params.messages,
        temperature: params.temperature ?? 0.1,
      };

      const reasoningEffort = params.reasoningEffort ?? this.reasoningEffort;
      if (reasoningEffort && reasoningEffort !== 'no_think') {
        input.extra_body = {
          chat_template_kwargs: { reasoning_effort: reasoningEffort },
        };
      }

      if (params.tools?.length) {
        input.tools = params.tools;
        input.tool_choice = params.toolChoice ?? 'auto';
      }

      const result = await model.generateText(input, {
        timeout: Math.max(60_000, params.timeoutMs ?? 60_000),
      });

      if (result.error) {
        this.logger.warn(
          `CloudBase generateText error: ${
            result.error instanceof Error
              ? result.error.message
              : String(result.error)
          }`,
        );
        return null;
      }

      const assistantMessage = this.pickAssistantMessage(result);
      return {
        choices: [
          {
            message: assistantMessage,
            finish_reason: Array.isArray(assistantMessage.tool_calls)
              ? 'tool_calls'
              : 'stop',
          },
        ],
      };
    } catch (error) {
      this.logger.warn(
        `CloudBase chat failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private pickAssistantMessage(result: {
    text?: string;
    messages?: Array<Record<string, unknown>>;
  }): Record<string, unknown> {
    const messages = result.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i -= 1) {
      const message = messages[i];
      if (message?.role === 'assistant') {
        return message;
      }
    }
    return {
      role: 'assistant',
      content: typeof result.text === 'string' ? result.text : '',
    };
  }

  private async getCloudbaseModel(): Promise<CloudbaseChatModel | null> {
    if (this.cloudbaseModel) {
      return this.cloudbaseModel;
    }
    if (!this.cloudbaseInitPromise) {
      this.cloudbaseInitPromise = this.initCloudbaseModel();
    }
    this.cloudbaseModel = await this.cloudbaseInitPromise;
    return this.cloudbaseModel;
  }

  /**
   * Independent Node.js service init (Nest / 云托管):
   * `tcb.init({ env, secretId, secretKey, timeout })` then `app.ai().createModel("cloudbase")`.
   */
  private async initCloudbaseModel(): Promise<CloudbaseChatModel | null> {
    try {
      const initOptions = buildCloudbaseInitOptions({
        envId: this.cloudbaseEnvId,
        secretId: this.cloudbaseSecretId,
        secretKey: this.cloudbaseSecretKey,
        accessKey: this.cloudbaseAccessKey,
        timeoutMs: CLOUDBASE_INIT_TIMEOUT_MS,
      });
      if (!initOptions) {
        this.logger.warn(
          'CloudBase AI init skipped: missing env or credentials',
        );
        return null;
      }

      const cloudbase = await import('@cloudbase/node-sdk');
      const app = cloudbase.init(initOptions);
      const ai = app.ai();
      return ai.createModel('cloudbase') as unknown as CloudbaseChatModel;
    } catch (error) {
      this.logger.warn(
        `CloudBase AI init failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
