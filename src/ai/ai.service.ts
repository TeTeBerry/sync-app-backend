import { Injectable } from '@nestjs/common';
import { AgentService } from './agent/agent.service';
import { ChatService } from '../modules/chat/chat.service';
import { LlmService } from './llm/llm.service';
import { AiStreamEvent, ChatRequestDto } from './dto/chat.dto';

@Injectable()
export class AiService {
  constructor(
    private readonly agent: AgentService,
    private readonly chatService: ChatService,
    private readonly llm: LlmService,
  ) {}

  async *streamChat(dto: ChatRequestDto): AsyncGenerator<AiStreamEvent> {
    const sessionId = this.chatService.resolveSessionId(dto.sessionId);

    if (!dto.messages?.length) {
      yield { type: 'error', message: 'messages 不能为空' };
      return;
    }

    if (!this.llm.enabled) {
      yield {
        type: 'error',
        message: '未配置 QWEN_API_KEY / DASHSCOPE_API_KEY，无法调用 AI',
      };
      return;
    }

    let assistantReply = '';

    try {
      for await (const token of this.agent.streamChat(dto.messages)) {
        assistantReply += token;
        yield { type: 'delta', content: token };
      }

      const messageId = await this.chatService.saveTurn({
        sessionId,
        userId: dto.userId,
        messages: dto.messages,
        assistantReply,
      });

      yield { type: 'done', messageId };
    } catch (error) {
      yield {
        type: 'error',
        message:
          error instanceof Error ? error.message : 'AI 对话失败，请稍后重试',
      };
    }
  }
}
