import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../common/auth/request-actor.types';
import { ChatMessageDto } from '../shared/chat';
import type { ConversationState } from './conversation';
import { CreatePostFromChatUseCase } from './buddy/create-post-from-chat.use-case';
import type { PostIntentCreateAttempt } from './buddy/buddy.types';

export type { PostIntentCreateAttempt } from './buddy/buddy.types';

@Injectable()
export class PostIntentService {
  constructor(private readonly createPostUseCase: CreatePostFromChatUseCase) {}

  async tryCreatePostFromChat(params: {
    messages: ChatMessageDto[];
    input: string;
    actor: RequestActor;
    activityLegacyId?: number;
    conversationState?: ConversationState | null;
    onStateChange?: (state: ConversationState) => void;
    fromAgentTool?: boolean;
  }): Promise<PostIntentCreateAttempt> {
    return this.createPostUseCase.execute(params);
  }
}
