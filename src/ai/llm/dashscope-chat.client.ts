import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DashscopeChatCompletionResponse {
  choices?: Array<{
    message?: Record<string, unknown>;
    finish_reason?: string;
  }>;
  error?: { message?: string };
}

@Injectable()
export class DashscopeChatClient {
  private readonly logger = new Logger(DashscopeChatClient.name);
  readonly apiKey: string;
  readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('llm.apiKey') ?? '';
    this.enabled = Boolean(this.apiKey && this.apiKey !== 'MISSING_API_KEY');
  }

  resolveAgentModel(): string {
    return (
      this.config.get<string>('ai.agent.model') ??
      this.config.get<string>('llm.jsonModel') ??
      'qwen-plus'
    );
  }

  async postChatCompletions(params: {
    body: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<DashscopeChatCompletionResponse | null> {
    if (!this.enabled) {
      return null;
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
          body: JSON.stringify(params.body),
          signal: controller.signal,
        },
      );

      const data = (await response.json()) as DashscopeChatCompletionResponse;
      if (!response.ok) {
        throw new Error(data.error?.message ?? `DashScope ${response.status}`);
      }

      return data;
    } catch (error) {
      this.logger.warn(
        `DashScope chat failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
