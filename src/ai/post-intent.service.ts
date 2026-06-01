import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../common/auth/request-actor.types';
import type { BuddySearchHintPayload } from './intent/chat-intent.types';
import { ChatMessageDto } from '../shared/chat';
import type { UserProfileSyncResult } from './agents/user-profile.agent';
import type { ConversationState } from './conversation';
import { CreatePostFromChatUseCase } from './buddy/create-post-from-chat.use-case';
import { MatchPostsFromChatUseCase } from './buddy/match-posts.use-case';
import { RecommendBeforeCreateUseCase } from './buddy/recommend-before-create.use-case';
import type {
  PostIntentCreateAttempt,
  PostIntentMatchResult,
} from './buddy/buddy.types';

export type {
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
    private readonly createPostUseCase: CreatePostFromChatUseCase,
    private readonly matchPostsUseCase: MatchPostsFromChatUseCase,
    private readonly recommendBeforeCreateUseCase: RecommendBeforeCreateUseCase,
  ) {}

  async tryCreatePostFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    actor: RequestActor;
    activityLegacyId?: number;
    image?: string;
    images?: string[];
    conversationState?: ConversationState | null;
    onStateChange?: (state: ConversationState) => void;
  }): Promise<PostIntentCreateAttempt> {
    return this.createPostUseCase.execute(params);
  }

  async tryProactiveRecommendBeforeCreate(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
    actor: RequestActor;
    conversationState?: ConversationState | null;
    profileSync?: UserProfileSyncResult | null;
  }): Promise<PostIntentMatchResult | null> {
    return this.recommendBeforeCreateUseCase.execute(params);
  }

  async tryMatchPostsFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
    actor: RequestActor;
    buddySearchHint?: BuddySearchHintPayload;
    fromIntentRouter?: boolean;
    profileSync?: UserProfileSyncResult | null;
  }): Promise<PostIntentMatchResult | null> {
    return this.matchPostsUseCase.execute(params);
  }
}
