import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
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
      temperature: 0.3,
    });
  }
}
