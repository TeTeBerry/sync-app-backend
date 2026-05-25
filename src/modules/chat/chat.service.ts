import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessageDto } from '../../ai/dto/chat.dto';
import {
  createIdleState,
  type ConversationState,
} from '../../ai/conversation/conversation-state.types';
import { Chat, ChatDocument } from '../../database/schemas/chat.schema';

export interface ChatSessionDto {
  sessionId: string;
  userId?: string;
  history: ChatMessageDto[];
  conversationState: ConversationState;
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

  /** 合并 MongoDB 历史与本次请求消息，供持久化与 LLM 上下文使用 */
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

  /** 保留最近 N 轮（1 轮 = 用户消息 + 可选助手回复），供通义千问上下文 */
  truncateToRecentTurns(
    messages: ChatMessageDto[],
    maxTurns = 6,
  ): ChatMessageDto[] {
    const normalized = this.normalizeHistory(messages);
    if (!normalized.length || maxTurns <= 0) return normalized;

    const turns: ChatMessageDto[][] = [];
    let current: ChatMessageDto[] = [];

    for (const message of normalized) {
      if (message.role === 'user') {
        if (current.length) {
          turns.push(current);
        }
        current = [message];
        continue;
      }

      if (current.length) {
        current.push(message);
      }
    }

    if (current.length) {
      turns.push(current);
    }

    return turns.slice(-maxTurns).reduce<ChatMessageDto[]>(
      (acc, turn) => acc.concat(turn),
      [],
    );
  }

  private normalizeConversationState(raw: unknown): ConversationState {
    if (!raw || typeof raw !== 'object') {
      return createIdleState();
    }
    const state = raw as ConversationState;
    if (!state.flow) {
      return createIdleState();
    }
    return {
      version: state.version ?? 1,
      flow: state.flow,
      findBuddy: state.findBuddy,
      ticketListing: state.ticketListing,
    };
  }

  async getSession(sessionId: string): Promise<ChatSessionDto> {
    const doc = await this.chatModel.findOne({ sessionId }).lean();
    return {
      sessionId,
      userId: doc?.userId,
      history: this.normalizeHistory(doc?.history),
      conversationState: this.normalizeConversationState(doc?.conversationState),
    };
  }

  async saveConversationState(
    sessionId: string,
    conversationState: ConversationState,
    userId?: string,
  ): Promise<void> {
    await this.chatModel.findOneAndUpdate(
      { sessionId },
      {
        sessionId,
        userId,
        conversationState,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );
  }

  async saveTurn(params: {
    sessionId: string;
    userId?: string;
    /** 完整对话（含本轮用户消息，不含助手回复） */
    messages: ChatMessageDto[];
    assistantReply: string;
    conversationState?: ConversationState;
  }): Promise<string> {
    const messageId = uuidv4();
    const stored = await this.getSession(params.sessionId);
    const merged = this.mergeChatHistory(stored.history, params.messages);
    const reply = params.assistantReply.trim();
    const history = reply
      ? [...merged, { role: 'assistant' as const, content: reply }]
      : merged;

    await this.chatModel.findOneAndUpdate(
      { sessionId: params.sessionId },
      {
        sessionId: params.sessionId,
        userId: params.userId,
        history,
        ...(params.conversationState
          ? { conversationState: params.conversationState }
          : {}),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return messageId;
  }
}
