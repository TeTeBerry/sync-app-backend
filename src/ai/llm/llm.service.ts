import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatAlibabaTongyiDashScope } from './chat-alibaba-tongyi-dashscope';

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
  public readonly llm: ChatAlibabaTongyiDashScope;
  public readonly jsonLlm: ChatAlibabaTongyiDashScope;
  public readonly rerankLlm: ChatAlibabaTongyiDashScope;
  public readonly vlModel: string;
  public readonly jsonModel: string;
  public readonly rerankModel: string;
  private readonly defaultModel: string;
  private readonly apiKey: string;
  public readonly enabled: boolean;
  public readonly visionEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('llm.apiKey') ?? '';
    this.enabled = Boolean(this.apiKey && this.apiKey !== 'MISSING_API_KEY');
    this.visionEnabled = this.enabled;
    this.vlModel = this.config.get<string>('llm.vlModel') ?? 'qwen-vl-plus';
    this.defaultModel = this.config.get<string>('llm.model') ?? 'qwen-max';
    this.jsonModel = this.config.get<string>('llm.jsonModel') ?? 'qwen-plus';
    this.rerankModel =
      this.config.get<string>('llm.rerankModel') ?? 'qwen-plus';

    const apiKey = this.apiKey || 'MISSING_API_KEY';
    const baseOptions = {
      alibabaApiKey: apiKey,
      temperature: 0.1,
    };

    this.llm = new ChatAlibabaTongyiDashScope({
      ...baseOptions,
      model: this.defaultModel,
      streaming: true,
    });

    this.jsonLlm = new ChatAlibabaTongyiDashScope({
      ...baseOptions,
      model: this.jsonModel,
      streaming: false,
    });

    this.rerankLlm = new ChatAlibabaTongyiDashScope({
      ...baseOptions,
      model: this.rerankModel,
      streaming: false,
    });
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
      const response = await this.withTimeout(
        this.jsonLlm.invoke([
          new SystemMessage(system),
          new HumanMessage(user),
        ]),
        timeoutMs,
      );
      const text = String(response.content ?? '').trim();
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
  ): Promise<T | null> {
    return this.invokeJsonWithModel<T>(this.jsonModel, system, user, timeoutMs);
  }

  /** 指定模型做结构化 JSON 抽取（如 post match rerank） */
  async invokeJsonWithModel<T>(
    model: string,
    system: string,
    user: string,
    timeoutMs = 15000,
  ): Promise<T | null> {
    if (!this.enabled) return null;

    const llm =
      model === this.jsonModel
        ? this.jsonLlm
        : model === this.rerankModel
          ? this.rerankLlm
          : model === this.defaultModel
            ? this.llm
            : new ChatAlibabaTongyiDashScope({
                alibabaApiKey: this.apiKey || 'MISSING_API_KEY',
                model,
                streaming: false,
                temperature: 0.1,
              });

    try {
      const response = await this.withTimeout(
        llm.invoke([new SystemMessage(system), new HumanMessage(user)]),
        timeoutMs,
      );
      return this.parseJsonFromText<T>(String(response.content ?? '').trim());
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

  /** 千问 VL（multimodal-generation）：图片 + 文本 → 结构化 JSON */
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
            Authorization: `Bearer ${this.apiKey}`,
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
