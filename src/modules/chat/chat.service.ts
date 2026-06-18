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

export interface ChatSessionMessagesPage {
  items: ChatMessageDto[];
  total: number;
  hasMore: boolean;
  nextBefore?: number;
  conversationState: ConversationState;
}

const DEFAULT_HISTORY_PAGE_SIZE = 30;
const MAX_HISTORY_PAGE_SIZE = 100;

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
    const createdPost = this.normalizeCreatedPost(message.createdPost);
    const suggestedReplies = this.normalizeSuggestedReplies(
      message.suggestedReplies,
    );

    if (
      !content &&
      !imageContext &&
      !recommendedActivity &&
      !createdPost &&
      !suggestedReplies?.length
    ) {
      return null;
    }

    return {
      role: message.role,
      content,
      ...(imageContext ? { imageContext } : {}),
      ...(recommendedActivity ? { recommendedActivity } : {}),
      ...(createdPost ? { createdPost } : {}),
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

  private normalizeCreatedPost(
    post?: ChatMessageDto['createdPost'],
  ): ChatMessageDto['createdPost'] | undefined {
    if (
      !post ||
      typeof post.postId !== 'string' ||
      !post.postId.trim() ||
      typeof post.snippet !== 'string' ||
      typeof post.authorName !== 'string' ||
      typeof post.eventTitle !== 'string'
    ) {
      return undefined;
    }
    return post;
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

  /** Merge persisted transcript with client window (suffix/prefix overlap). */
  mergeChatHistory(
    stored: ChatMessageDto[],
    incoming: ChatMessageDto[],
  ): ChatMessageDto[] {
    const normalizedStored = this.normalizeHistory(stored);
    const normalizedIncoming = this.normalizeHistory(incoming);
    if (!normalizedStored.length) return normalizedIncoming;
    if (!normalizedIncoming.length) return normalizedStored;

    let overlap = 0;
    const maxOverlap = Math.min(
      normalizedStored.length,
      normalizedIncoming.length,
    );
    for (let size = maxOverlap; size > 0; size -= 1) {
      const suffix = normalizedStored.slice(-size);
      const prefix = normalizedIncoming.slice(0, size);
      const matches = suffix.every(
        (message, index) =>
          message.role === prefix[index]?.role &&
          message.content === prefix[index]?.content,
      );
      if (matches) {
        overlap = size;
        break;
      }
    }

    return [...normalizedStored, ...normalizedIncoming.slice(overlap)];
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
    const flow =
      (state as { flow?: string }).flow === 'recommend_gate'
        ? 'idle'
        : state.flow;
    return {
      version: state.version ?? CONVERSATION_STATE_VERSION,
      flow,
      ...(state.publishDraft ? { publishDraft: state.publishDraft } : {}),
    };
  }

  async getSession(sessionId: string): Promise<ChatSessionDto> {
    const doc = await this.chatModel.findOne({ sessionId }).lean();
    if (!doc) {
      return {
        sessionId,
        history: [],
        conversationState: createIdleState(),
      };
    }

    return {
      sessionId,
      userId: doc.userId,
      history: this.normalizeHistory(doc.history),
      conversationState: this.normalizeConversationState(doc.conversationState),
    };
  }

  async getSessionMessages(
    sessionId: string,
    options?: { limit?: number; before?: number },
  ): Promise<ChatSessionMessagesPage> {
    const session = await this.getSession(sessionId);
    const history = session.history;
    const limit = Math.min(
      Math.max(options?.limit ?? DEFAULT_HISTORY_PAGE_SIZE, 1),
      MAX_HISTORY_PAGE_SIZE,
    );
    const end =
      options?.before != null && Number.isFinite(options.before)
        ? Math.min(Math.max(0, Math.floor(options.before)), history.length)
        : history.length;
    const start = Math.max(0, end - limit);
    const items = history.slice(start, end);
    const hasMore = start > 0;

    return {
      items,
      total: history.length,
      hasMore,
      nextBefore: hasMore ? start : undefined,
      conversationState: session.conversationState,
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

  async saveTurn(params: {
    sessionId: string;
    userId?: string;
    messages: ChatMessageDto[];
    assistantReply: string;
    conversationState?: ConversationState;
    assistantMetadata?: Omit<ChatMessageRichMetadata, 'imageContext'>;
  }): Promise<string> {
    const stored = await this.getSession(params.sessionId);
    let history = this.mergeChatHistory(stored.history, params.messages);

    const assistantContent = params.assistantReply?.trim() ?? '';
    if (assistantContent) {
      const assistantMessage = this.normalizeMessage({
        role: 'assistant',
        content: assistantContent,
        ...(params.assistantMetadata ?? {}),
      });
      if (assistantMessage) {
        const last = history[history.length - 1];
        const duplicateAssistant =
          last?.role === 'assistant' &&
          last.content === assistantMessage.content;
        if (!duplicateAssistant) {
          history = [...history, assistantMessage];
        }
      }
    }

    await this.chatModel.findOneAndUpdate(
      { sessionId: params.sessionId },
      {
        sessionId: params.sessionId,
        userId: params.userId ?? stored.userId,
        history,
        conversationState:
          params.conversationState ??
          stored.conversationState ??
          createIdleState(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return uuidv4();
  }
}
