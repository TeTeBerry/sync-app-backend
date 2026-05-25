import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HumanMessage, SystemMessage } from '@langchain/core/messages';
import { ChatAlibabaTongyi } from '@langchain/community/chat_models/alibaba_tongyi';

@Injectable()
export class LlmService {
  public readonly llm: ChatAlibabaTongyi;
  public readonly enabled: boolean;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('llm.apiKey') ?? '';
    this.enabled = Boolean(apiKey && apiKey !== 'MISSING_API_KEY');

    this.llm = new ChatAlibabaTongyi({
      alibabaApiKey: apiKey || 'MISSING_API_KEY',
      model: this.config.get<string>('llm.model') ?? 'qwen-turbo',
      streaming: true,
      temperature: 0.1,
    });
  }

  /** 结构化 JSON 抽取（非 Function Calling，低温度） */
  async invokeJson<T>(system: string, user: string): Promise<T | null> {
    if (!this.enabled) return null;

    const response = await this.llm.invoke([
      new SystemMessage(system),
      new HumanMessage(user),
    ]);

    const text = String(response.content ?? '').trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    try {
      return JSON.parse(jsonMatch[0]) as T;
    } catch {
      return null;
    }
  }
}
