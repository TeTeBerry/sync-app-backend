import { Injectable } from '@nestjs/common';
import type { ConversationState } from './conversation';
import type { BuddySearchHintPayload } from './intent/chat-intent.types';
import { ChatMessageDto } from './presentation/chat-message.dto';
import type { UserProfileSyncResult } from './agents/user-profile.agent';
import {
  buildBuddyCopyVariant,
  buildBuddyCopyVariants,
  detectBuddyCopyStyleRequest,
} from './conversation/buddy-copy.util';
import { parseConversationContext } from './conversation/conversation-context.parser';
import { BuddyContextService } from './buddy/buddy-context.service';
import { CreatePostFromChatUseCase } from './buddy/create-post-from-chat.use-case';
import { MatchPostsFromChatUseCase } from './buddy/match-posts.use-case';
import { RecommendBeforeCreateUseCase } from './buddy/recommend-before-create.use-case';
import type {
  PostIntentBuddyCopyResult,
  PostIntentCreateAttempt,
  PostIntentMatchResult,
} from './buddy/buddy.types';

export type {
  PostIntentBuddyCopyResult,
  PostIntentCreateAttempt,
  PostIntentCreateResult,
  PostIntentExistingPostResult,
  PostIntentMatchResult,
  PostIntentPendingConfirmationResult,
  PostIntentRejectedResult,
} from './buddy/buddy.types';

@Injectable()
export class PostIntentService {
  constructor(
    private readonly buddyContext: BuddyContextService,
    private readonly createPostUseCase: CreatePostFromChatUseCase,
    private readonly matchPostsUseCase: MatchPostsFromChatUseCase,
    private readonly recommendBeforeCreateUseCase: RecommendBeforeCreateUseCase,
  ) {}

  async tryCreatePostFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    userId?: string;
    userName?: string;
    activityLegacyId?: number;
    image?: string;
    conversationState?: ConversationState | null;
    onStateChange?: (state: ConversationState) => void;
  }): Promise<PostIntentCreateAttempt> {
    return this.createPostUseCase.execute(params);
  }

  async tryProactiveRecommendBeforeCreate(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
    userId?: string;
    conversationState?: ConversationState | null;
    profileSync?: UserProfileSyncResult | null;
  }): Promise<PostIntentMatchResult | null> {
    return this.recommendBeforeCreateUseCase.execute(params);
  }

  async tryMatchPostsFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
    userId?: string;
    buddySearchHint?: BuddySearchHintPayload;
    fromIntentRouter?: boolean;
    profileSync?: UserProfileSyncResult | null;
  }): Promise<PostIntentMatchResult | null> {
    return this.matchPostsUseCase.execute(params);
  }

  async tryGenerateBuddyCopy(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
  }): Promise<PostIntentBuddyCopyResult | null> {
    const styleRequest = detectBuddyCopyStyleRequest(params.input);
    if (!styleRequest) return null;

    const ctx = parseConversationContext(params.messages, params.input);
    const resolvedActivity = await this.buddyContext.resolveActivity(
      ctx,
      params.activityLegacyId,
    );
    const baseDraft = await this.buddyContext.buildPostBody({
      ctx,
      input: params.input,
      activityName: resolvedActivity?.name,
      messages: params.messages,
      activityLegacyId: resolvedActivity?.legacyId ?? params.activityLegacyId,
    });

    const variants =
      styleRequest === 'all'
        ? buildBuddyCopyVariants(baseDraft, resolvedActivity?.name, ctx)
        : [
            buildBuddyCopyVariant(
              styleRequest,
              baseDraft,
              resolvedActivity?.name,
              ctx,
            ),
          ];

    const lines = [
      '为你生成了组队文案，点选下方风格或回复「确认发布」即可：',
      '',
      ...variants.map(variant => `【${variant.label}】\n${variant.body}`),
    ];

    return {
      replyText: lines.join('\n'),
      variants,
    };
  }
}
