/** Text via Hunyuan (TextLlmClient); vision via DashScope VL (QWEN_API_KEY). See docs/LLM.md. */
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TextLlmClient, type HunyuanReasoningEffort } from './text-llm.client';

export type LlmInvokeJsonOptions = {
  reasoningEffort?: HunyuanReasoningEffort;
};

const MULTIMODAL_API_URL =
  'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation';

interface DashScopeMultimodalResponse {
  code?: string;
  message?: string;
  output?: {
    choices?: Array<{
      message?: {
        content?: string | Array<{ text?: string }>;
      };
    }>;
  };
}

function extractMultimodalText(data: DashScopeMultimodalResponse): string {
  const content = data.output?.choices?.[0]?.message?.content;
  if (typeof content === 'string') return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part === 'string' ? part : (part?.text ?? '')))
      .join('')
      .trim();
  }
  return '';
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  public readonly vlModel: string;
  public readonly jsonModel: string;
  public readonly textProvider: string;
  /** Hunyuan text JSON / agent tasks. */
  public readonly enabled: boolean;
  /** Qwen VL multimodal (requires QWEN_API_KEY). */
  public readonly visionEnabled: boolean;
  private readonly vlApiKey: string;

  constructor(
    private readonly config: ConfigService,
    private readonly textLlm: TextLlmClient,
  ) {
    this.vlApiKey = this.config.get<string>('llm.vlApiKey') ?? '';
    this.enabled = this.textLlm.enabled;
    this.visionEnabled = Boolean(
      this.vlApiKey && this.vlApiKey !== 'MISSING_API_KEY',
    );
    this.vlModel = this.config.get<string>('llm.vlModel') ?? 'qwen-vl-plus';
    this.jsonModel = this.textLlm.jsonModel;
    this.textProvider = this.textLlm.provider;
  }

  private parseJsonFromText<T>(text: string): T | null {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      return null;
    }
  }

  /** 纯文本生成（翻译、摘要等） */
  async invokeText(
    system: string,
    user: string,
    timeoutMs = 15_000,
  ): Promise<string | null> {
    if (!this.enabled) return null;

    try {
      const data = await this.textLlm.chat({
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        model: this.jsonModel,
        temperature: 0.1,
        timeoutMs,
      });
      const text = this.textLlm.extractAssistantText(data);
      return text || null;
    } catch (error) {
      this.logger.warn(
        `invokeText failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  /** 结构化 JSON 抽取（非 Function Calling，低温度） */
  async invokeJson<T>(
    system: string,
    user: string,
    timeoutMs = 15000,
    options?: LlmInvokeJsonOptions,
  ): Promise<T | null> {
    return this.invokeJsonWithModel<T>(
      this.jsonModel,
      system,
      user,
      timeoutMs,
      options,
    );
  }

  /** 指定模型做结构化 JSON 抽取 */
  async invokeJsonWithModel<T>(
    model: string,
    system: string,
    user: string,
    timeoutMs = 15000,
    options?: LlmInvokeJsonOptions,
  ): Promise<T | null> {
    if (!this.enabled) return null;

    try {
      const data = await this.withTimeout(
        this.textLlm.chat({
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
          model,
          temperature: 0.1,
          timeoutMs,
          reasoningEffort: options?.reasoningEffort,
        }),
        timeoutMs,
      );
      const text = this.textLlm.extractAssistantText(data);
      return this.parseJsonFromText<T>(text);
    } catch (error) {
      this.logger.warn(
        `invokeJsonWithModel failed (${model}): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }

  private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    const timeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`LLM timeout after ${ms}ms`)), ms),
    );
    return Promise.race([promise, timeout]);
  }

  /** 千问 VL（DashScope multimodal-generation）：图片 + 文本 → 结构化 JSON */
  async invokeVisionJson<T>(
    system: string,
    userText: string,
    imageDataUrl: string,
  ): Promise<T | null> {
    if (!this.visionEnabled) return null;

    try {
      const buildPayload = (includeResultFormat: boolean) => ({
        model: this.vlModel,
        input: {
          messages: [
            { role: 'system', content: [{ text: system }] },
            {
              role: 'user',
              content: [{ image: imageDataUrl }, { text: userText }],
            },
          ],
        },
        parameters: includeResultFormat
          ? {
              temperature: 0.1,
              result_format: 'message',
            }
          : {
              temperature: 0.1,
            },
      });

      const doRequest = (includeResultFormat: boolean) =>
        fetch(MULTIMODAL_API_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.vlApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(buildPayload(includeResultFormat)),
        });

      let response = await doRequest(true);
      let data = (await response.json()) as DashScopeMultimodalResponse;

      const unsupportedResultFormat =
        !response.ok && /result_format/i.test(String(data.message ?? ''));

      if (unsupportedResultFormat) {
        this.logger.warn(
          'Vision model does not support result_format, retrying without it',
        );
        response = await doRequest(false);
        data = (await response.json()) as DashScopeMultimodalResponse;
      }

      if (!response.ok || data.code) {
        throw new Error(data.message ?? `VL 请求失败 (${response.status})`);
      }

      const text = extractMultimodalText(data);
      return this.parseJsonFromText<T>(text);
    } catch (error) {
      this.logger.warn(
        `Vision parse failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return null;
    }
  }
}
