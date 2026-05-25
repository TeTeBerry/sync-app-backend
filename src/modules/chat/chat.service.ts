import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessageDto } from '../../ai/dto/chat.dto';
import { Chat, ChatDocument } from '../../database/schemas/chat.schema';

export interface ChatSessionDto {
  sessionId: string;
  userId?: string;
  history: ChatMessageDto[];
}

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name)
    private readonly chatModel: Model<ChatDocument>,
  ) {}

  health() {
    return { ok: true, scope: 'chat' };
  }

  resolveSessionId(sessionId?: string): string {
    return sessionId?.trim() || uuidv4();
  }

  private normalizeMessage(
    message?: { role?: string; content?: string } | null,
  ): ChatMessageDto | null {
    if (!message?.content?.trim()) return null;
    if (
      message.role !== 'user' &&
      message.role !== 'assistant' &&
      message.role !== 'system'
    ) {
      return null;
    }
    return {
      role: message.role,
      content: message.content.trim(),
    };
  }

  private normalizeHistory(
    history?: Array<{ role?: string; content?: string }>,
  ): ChatMessageDto[] {
    if (!history?.length) return [];
    return history
      .map(item => this.normalizeMessage(item))
      .filter((item): item is ChatMessageDto => Boolean(item));
  }

  /** 合并 MongoDB 历史与本次请求消息，供 LLM 上下文使用 */
  mergeChatHistory(
    stored: ChatMessageDto[],
    incoming: ChatMessageDto[],
  ): ChatMessageDto[] {
    const storedNorm = this.normalizeHistory(stored);
    const incomingNorm = this.normalizeHistory(incoming);

    if (!storedNorm.length) return incomingNorm;
    if (!incomingNorm.length) return storedNorm;

    const prefixMatches = storedNorm.every(
      (message, index) =>
        incomingNorm[index]?.role === message.role &&
        incomingNorm[index]?.content === message.content,
    );
    if (prefixMatches && incomingNorm.length >= storedNorm.length) {
      return incomingNorm;
    }

    const lastIncomingUser = [...incomingNorm]
      .reverse()
      .find(message => message.role === 'user');
    if (!lastIncomingUser) return storedNorm;

    const lastStored = storedNorm[storedNorm.length - 1];
    if (lastStored?.role === 'assistant') {
      return [...storedNorm, lastIncomingUser];
    }
    if (
      lastStored?.role === 'user' &&
      lastStored.content === lastIncomingUser.content
    ) {
      return storedNorm;
    }
    if (lastStored?.role === 'user') {
      return [...storedNorm.slice(0, -1), lastIncomingUser];
    }

    return [...storedNorm, lastIncomingUser];
  }

  async getSession(sessionId: string): Promise<ChatSessionDto> {
    const doc = await this.chatModel.findOne({ sessionId }).lean();
    return {
      sessionId,
      userId: doc?.userId,
      history: this.normalizeHistory(doc?.history),
    };
  }

  async saveTurn(params: {
    sessionId: string;
    userId?: string;
    messages: ChatMessageDto[];
    assistantReply: string;
  }): Promise<string> {
    const messageId = uuidv4();
    const prior = this.normalizeHistory(params.messages);
    const reply = params.assistantReply.trim();
    const history = reply
      ? [...prior, { role: 'assistant' as const, content: reply }]
      : prior;

    await this.chatModel.findOneAndUpdate(
      { sessionId: params.sessionId },
      {
        sessionId: params.sessionId,
        userId: params.userId,
        history,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return messageId;
  }
}
