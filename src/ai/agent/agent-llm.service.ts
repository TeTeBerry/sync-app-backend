/** Agent tool-calling over TextLlmClient (Hunyuan). Vision not used here. */
import { Injectable } from '@nestjs/common';
import { TextLlmClient } from '../../infra/llm/text-llm.client';

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

@Injectable()
export class AgentLlmService {
  private readonly model: string;
  readonly enabled: boolean;

  constructor(private readonly textLlm: TextLlmClient) {
    this.enabled = this.textLlm.enabled;
    this.model = this.textLlm.resolveAgentModel();
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

    const data = await this.textLlm.chat({
      messages: params.messages,
      model: this.model,
      temperature: 0.2,
      timeoutMs: params.timeoutMs,
      tools: params.tools,
      toolChoice: 'auto',
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
