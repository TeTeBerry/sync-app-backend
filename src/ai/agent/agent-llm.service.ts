import { Injectable } from '@nestjs/common';
import { DashscopeChatClient } from '../llm/dashscope-chat.client';

interface OpenAiToolCall {
  id?: string;
  type?: string;
  function?: {
    name?: string;
    arguments?: string;
  };
}

export interface OpenAiChatMessage {
  role: string;
  content?: string | null;
  tool_calls?: OpenAiToolCall[];
  tool_call_id?: string;
}

function isQwenHybridThinkingModel(model: string): boolean {
  return /qwen3/i.test(model);
}

@Injectable()
export class AgentLlmService {
  private readonly model: string;
  readonly enabled: boolean;

  constructor(private readonly dashscope: DashscopeChatClient) {
    this.enabled = this.dashscope.enabled;
    this.model = this.dashscope.resolveAgentModel();
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

    const data = await this.dashscope.postChatCompletions({
      body,
      timeoutMs: params.timeoutMs,
    });

    if (!data) {
      return null;
    }

    const message = data.choices?.[0]?.message;
    if (!message) {
      return null;
    }

    return message as unknown as OpenAiChatMessage;
  }
}

export type { OpenAiToolCall };

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
