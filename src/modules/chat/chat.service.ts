import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { ChatMessageDto } from '../../ai/presentation/chat-message.dto';
import type { ChatMessageRichMetadata } from '../../ai/presentation/chat-message-metadata.util';
import {
  CONVERSATION_STATE_VERSION,
  createIdleState,
  type ConversationState,
} from '../../ai/conversation';
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
    const recommendedPosts = this.normalizeRecommendedPosts(
      message.recommendedPosts,
    );
    const createdPost = this.normalizeCreatedPost(message.createdPost);
    const suggestedReplies = this.normalizeSuggestedReplies(
      message.suggestedReplies,
    );

    if (
      !content &&
      !imageContext &&
      !recommendedPosts?.length &&
      !createdPost &&
      !suggestedReplies?.length
    ) {
      return null;
    }

    return {
      role: message.role,
      content,
      ...(imageContext ? { imageContext } : {}),
      ...(recommendedPosts?.length ? { recommendedPosts } : {}),
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

  private normalizeRecommendedPosts(
    posts?: ChatMessageDto['recommendedPosts'],
  ): ChatMessageDto['recommendedPosts'] | undefined {
    if (!posts?.length) return undefined;
    const normalized = posts.filter(
      post =>
        typeof post?.postId === 'string' &&
        post.postId.trim() &&
        typeof post?.snippet === 'string' &&
        typeof post?.authorName === 'string' &&
        typeof post?.eventTitle === 'string',
    );
    return normalized.length ? normalized : undefined;
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
      .map(reply => reply?.trim())
      .filter((reply): reply is string => Boolean(reply));
    return normalized.length ? normalized : undefined;
  }

  private normalizeHistory(
    history?: Array<Partial<ChatMessageDto>>,
  ): ChatMessageDto[] {
    if (!history?.length) return [];
    return history
      .map(item => this.normalizeMessage(item))
      .filter((item): item is ChatMessageDto => Boolean(item));
  }

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
      version: state.version ?? CONVERSATION_STATE_VERSION,
      flow: state.flow,
      ...(state.gate ? { gate: state.gate } : {}),
      ...(state.publishDraft ? { publishDraft: state.publishDraft } : {}),
    };
  }

  async getSession(sessionId: string): Promise<ChatSessionDto> {
    const doc = await this.chatModel.findOne({ sessionId }).lean();
    return {
      sessionId,
      userId: doc?.userId,
      history: this.normalizeHistory(
        doc?.history as Array<Partial<ChatMessageDto>> | undefined,
      ),
      conversationState: this.normalizeConversationState(doc?.conversationState),
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
    const messageId = uuidv4();
    const stored = await this.getSession(params.sessionId);
    const merged = this.mergeChatHistory(stored.history, params.messages);
    const reply = params.assistantReply.trim();
    const assistantMetadata = params.assistantMetadata ?? {};
    const history =
      reply ||
      assistantMetadata.recommendedPosts?.length ||
      assistantMetadata.createdPost ||
      assistantMetadata.suggestedReplies?.length
        ? [
            ...merged,
            {
              role: 'assistant' as const,
              content: reply,
              ...assistantMetadata,
            },
          ]
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
