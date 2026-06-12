import { Logger } from '@nestjs/common';
import type { OpenAiChatCompletionResponse } from './openai-chat.types';

export type OpenAiChatClientOptions = {
  apiKey: string;
  baseUrl: string;
  logger?: Logger;
};

/** Minimal OpenAI-compatible chat/completions client (DashScope compatible-mode / Tencent TokenHub). */
export class OpenAiChatClient {
  private readonly logger: Logger;
  private readonly apiKey: string;
  private readonly completionsUrl: string;

  constructor(options: OpenAiChatClientOptions) {
    this.apiKey = options.apiKey;
    this.logger = options.logger ?? new Logger(OpenAiChatClient.name);
    const base = options.baseUrl.replace(/\/$/, '');
    this.completionsUrl = `${base}/chat/completions`;
  }

  get enabled(): boolean {
    return Boolean(this.apiKey && this.apiKey !== 'MISSING_API_KEY');
  }

  async postChatCompletions(params: {
    body: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<OpenAiChatCompletionResponse | null> {
    if (!this.enabled) {
      return null;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => controller.abort(),
      params.timeoutMs ?? 25_000,
    );

    try {
      const response = await fetch(this.completionsUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(params.body),
        signal: controller.signal,
      });

      const data = (await response.json()) as OpenAiChatCompletionResponse;
      if (!response.ok) {
        throw new Error(
          data.error?.message ?? `OpenAI-compatible chat ${response.status}`,
        );
      }

      return data;
    } catch (error) {
      this.logger.warn(
        `Chat completion failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
