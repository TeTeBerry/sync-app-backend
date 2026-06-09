import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OpenAiToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

interface OpenAiChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

interface OpenAiChatCompletionResponse {
  choices?: Array<{
    message?: OpenAiChatMessage;
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

function isQwenHybridThinkingModel(model: string): boolean {
  return /qwen3/i.test(model);
}

@Injectable()
export class AgentLlmService {
  private readonly logger = new Logger(AgentLlmService.name);
  private readonly apiKey: string;
  private readonly model: string;
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('llm.apiKey') ?? '';
    this.enabled = Boolean(this.apiKey && this.apiKey !== 'MISSING_API_KEY');
    this.model =
      this.config.get<string>('ai.agent.model') ??
      this.config.get<string>('llm.jsonModel') ??
      'qwen-plus';
  }

  async chatWithTools(params: {
    messages: OpenAiChatMessage[];
    tools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string;
        parameters: Record<string, unknown>;
      };
    }>;
    timeoutMs?: number;
  }): Promise<OpenAiChatMessage | null> {
    if (!this.enabled) {
      return null;
    }

    const body: Record<string, unknown> = {
      model: this.model,
      temperature: 0.2,
      stream: false,
      messages: params.messages,
      tools: params.tools,
      tool_choice: 'auto',
    };

    if (isQwenHybridThinkingModel(this.model)) {
      body.enable_thinking = false;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      params.timeoutMs ?? 25_000,
    );

    try {
      const response = await fetch(
        'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(body),
          signal: controller.signal,
        },
      );

      const data = (await response.json()) as OpenAiChatCompletionResponse;
      if (!response.ok) {
        throw new Error(data.error?.message ?? `DashScope ${response.status}`);
      }

      return data.choices?.[0]?.message ?? null;
    } catch (error) {
      this.logger.warn(
        `chatWithTools failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}

export type { OpenAiChatMessage, OpenAiToolCall };

export function parseToolCallArgs(raw?: string): Record<string, unknown> {
  if (!raw?.trim()) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}
