/**
 * Text LLM: Hunyuan TokenHub only (OpenAI-compatible). Vision uses QWEN_API_KEY
 * in LlmService.invokeVisionJson. See docs/LLM.md.
 */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OpenAiChatClient } from './openai-chat.client';
import type {
  OpenAiChatCompletionResponse,
  OpenAiChatMessageInput,
} from './openai-chat.types';

export type TextLlmProvider = 'hunyuan' | 'none';

/** Hunyuan hy3 `chat_template_kwargs.reasoning_effort` */
export type HunyuanReasoningEffort = 'no_think' | 'low' | 'high';

@Injectable()
export class TextLlmClient {
  private readonly logger = new Logger(TextLlmClient.name);
  readonly provider: TextLlmProvider;
  readonly enabled: boolean;
  readonly jsonModel: string;

  private readonly client: OpenAiChatClient | null;
  private readonly reasoningEffort: string;

  constructor(private readonly config: ConfigService) {
    const hunyuanKey = this.config.get<string>('hunyuan.apiKey') ?? '';

    this.reasoningEffort =
      this.config.get<string>('hunyuan.reasoningEffort') ?? 'no_think';

    if (hunyuanKey) {
      this.provider = 'hunyuan';
      this.client = new OpenAiChatClient({
        apiKey: hunyuanKey,
        baseUrl:
          this.config.get<string>('hunyuan.baseUrl') ??
          'https://tokenhub.tencentmaas.com/v1',
        logger: this.logger,
      });
      this.jsonModel =
        this.config.get<string>('hunyuan.textModel') ?? 'hy3-preview';
    } else {
      this.provider = 'none';
      this.client = null;
      this.jsonModel = 'hy3-preview';
    }

    this.enabled = Boolean(this.client?.enabled);
  }

  resolveAgentModel(): string {
    const configured = this.config.get<string>('ai.agent.model')?.trim();
    return configured || this.jsonModel;
  }

  async chat(params: {
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
  }): Promise<OpenAiChatCompletionResponse | null> {
    if (!this.client?.enabled) {
      return null;
    }

    const model = params.model ?? this.jsonModel;
    const body: Record<string, unknown> = {
      model,
      messages: params.messages,
      temperature: params.temperature ?? 0.1,
      stream: false,
      extra_body: {
        chat_template_kwargs: {
          reasoning_effort: params.reasoningEffort ?? this.reasoningEffort,
        },
      },
    };

    if (params.tools?.length) {
      body.tools = params.tools;
      body.tool_choice = params.toolChoice ?? 'auto';
    }

    return this.client.postChatCompletions({
      body,
      timeoutMs: params.timeoutMs,
    });
  }

  extractAssistantText(data: OpenAiChatCompletionResponse | null): string {
    const message = data?.choices?.[0]?.message;
    const content = message?.content;
    if (typeof content === 'string') {
      return content.trim();
    }
    return '';
  }
}
