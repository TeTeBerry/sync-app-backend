import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessageRichMetadata } from '../../ai/presentation/chat-message-metadata.util';
import {
  ChatMessageDto,
  CONVERSATION_STATE_VERSION,
  createIdleState,
  type ConversationState,
} from '../../shared/chat';
import { Chat, ChatDocument } from '../../database/schemas/chat.schema';

/** Max user/assistant turns sent to LLM intent + buddy pipelines per request. */
export const CHAT_LLM_CONTEXT_TURNS = 6;

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
    message?: Partial<ChatMessageDto> | null,
  ): ChatMessageDto | null {
    if (!message) return null;
    if (
      message.role !== 'user' &&
      message.role !== 'assistant' &&
      message.role !== 'system'
    ) {
      return null;
    }

    const content = message.content?.trim() ?? '';
    const imageContext = this.normalizeImageContext(message.imageContext);
    const recommendedActivity = this.normalizeRecommendedActivity(
      message.recommendedActivity,
    );
    const suggestedReplies = this.normalizeSuggestedReplies(
      message.suggestedReplies,
    );

    if (
      !content &&
      !imageContext &&
      !recommendedActivity &&
      !suggestedReplies?.length
    ) {
      return null;
    }

    return {
      role: message.role,
      content,
      ...(imageContext ? { imageContext } : {}),
      ...(recommendedActivity ? { recommendedActivity } : {}),
      ...(suggestedReplies?.length ? { suggestedReplies } : {}),
    };
  }

  private normalizeImageContext(
    imageContext?: ChatMessageDto['imageContext'],
  ): ChatMessageDto['imageContext'] | undefined {
    if (!imageContext) return undefined;
    const source = imageContext.source?.trim();
    const ocrText = imageContext.ocrText?.trim();
    if (!source && !ocrText) return undefined;
    return {
      ...(source ? { source } : {}),
      ...(ocrText ? { ocrText } : {}),
    };
  }

  private normalizeRecommendedActivity(
    activity?: ChatMessageDto['recommendedActivity'],
  ): ChatMessageDto['recommendedActivity'] | undefined {
    if (
      !activity ||
      typeof activity.activityLegacyId !== 'number' ||
      Number.isNaN(activity.activityLegacyId) ||
      typeof activity.title !== 'string' ||
      !activity.title.trim()
    ) {
      return undefined;
    }
    const date = activity.date?.trim();
    const venue = activity.venue?.trim();
    return {
      activityLegacyId: activity.activityLegacyId,
      title: activity.title.trim(),
      ...(date ? { date } : {}),
      ...(venue ? { venue } : {}),
    };
  }

  private normalizeSuggestedReplies(
    replies?: ChatMessageDto['suggestedReplies'],
  ): ChatMessageDto['suggestedReplies'] | undefined {
    if (!replies?.length) return undefined;
    const normalized = replies
      .map((reply) => reply?.trim())
      .filter((reply): reply is string => Boolean(reply));
    return normalized.length ? normalized : undefined;
  }

  private normalizeHistory(
    history?: Array<Partial<ChatMessageDto>>,
  ): ChatMessageDto[] {
    if (!history?.length) return [];
    return history
      .map((item) => this.normalizeMessage(item))
      .filter((item): item is ChatMessageDto => Boolean(item));
  }

  /** Stateless chat: only the current request messages are used (stored history ignored). */
  mergeChatHistory(
    _stored: ChatMessageDto[],
    incoming: ChatMessageDto[],
  ): ChatMessageDto[] {
    return this.normalizeHistory(incoming);
  }

  truncateToRecentTurns(
    messages: ChatMessageDto[],
    maxTurns = CHAT_LLM_CONTEXT_TURNS,
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

    return turns
      .slice(-maxTurns)
      .reduce<ChatMessageDto[]>((acc, turn) => acc.concat(turn), []);
  }

  private normalizeConversationState(raw: unknown): ConversationState {
    if (!raw || typeof raw !== 'object') {
      return createIdleState();
    }
    const state = raw as ConversationState;
    if (!state.flow) {
      return createIdleState();
    }
    const legacyFlow = (state as { flow?: string }).flow;
    const flow =
      legacyFlow === 'idle' ||
      legacyFlow === 'recommend_gate' ||
      legacyFlow === 'publish_confirm' ||
      legacyFlow === 'collect_post_body' ||
      legacyFlow === 'clarify_buddy'
        ? 'idle'
        : 'idle';
    return {
      version: state.version ?? CONVERSATION_STATE_VERSION,
      flow,
    };
  }

  async getSession(sessionId: string): Promise<ChatSessionDto> {
    return {
      sessionId,
      history: [],
      conversationState: createIdleState(),
    };
  }

  async clearSession(sessionId: string): Promise<void> {
    await this.chatModel.deleteOne({ sessionId });
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

  /** Stateless: assign message id only; do not persist transcript or flow state. */
  async saveTurn(_params: {
    sessionId: string;
    userId?: string;
    messages: ChatMessageDto[];
    assistantReply: string;
    conversationState?: ConversationState;
    assistantMetadata?: Omit<ChatMessageRichMetadata, 'imageContext'>;
  }): Promise<string> {
    return uuidv4();
  }
}
