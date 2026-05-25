import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';

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
      .map(part => (typeof part === 'string' ? part : part?.text ?? ''))
      .join('')
      .trim();
  }
  return '';
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  public readonly llm: ChatAlibabaTongyi;
  public readonly vlModel: string;
  private readonly apiKey: string;
  public readonly enabled: boolean;
  public readonly visionEnabled: boolean;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('llm.apiKey') ?? '';
    this.enabled = Boolean(this.apiKey && this.apiKey !== 'MISSING_API_KEY');
    this.visionEnabled = this.enabled;
    this.vlModel = this.config.get<string>('llm.vlModel') ?? 'qwen-vl-plus';

    this.llm = new ChatAlibabaTongyi({
      alibabaApiKey: this.apiKey || 'MISSING_API_KEY',
      model: this.config.get<string>('llm.model') ?? 'qwen-turbo',
      streaming: true,
      temperature: 0.1,
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

  /** 结构化 JSON 抽取（非 Function Calling，低温度） */
  async invokeJson<T>(system: string, user: string): Promise<T | null> {
    if (!this.enabled) return null;

    const response = await this.llm.invoke([
      new SystemMessage(system),
      new HumanMessage(user),
    ]);

    return this.parseJsonFromText<T>(String(response.content ?? '').trim());
  }

  /** 千问 VL（multimodal-generation）：图片 + 文本 → 结构化 JSON */
  async invokeVisionJson<T>(
    system: string,
    userText: string,
    imageDataUrl: string,
  ): Promise<T | null> {
    if (!this.visionEnabled) return null;

    try {
      const response = await fetch(MULTIMODAL_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.vlModel,
          input: {
            messages: [
              { role: 'system', content: [{ text: system }] },
              {
                role: 'user',
                content: [
                  { image: imageDataUrl },
                  { text: userText },
                ],
              },
            ],
          },
          parameters: {
            temperature: 0.1,
            result_format: 'message',
          },
        }),
      });

      const data = (await response.json()) as DashScopeMultimodalResponse;
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
