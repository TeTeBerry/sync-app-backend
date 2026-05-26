import { Injectable } from '@nestjs/common';
import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import type { ConversationState } from '../conversation';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import { parseConversationContext } from '../conversation/conversation-context.parser';
import { isExplicitReplacePostIntent } from '../conversation/existing-post-guidance.util';
import {
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
} from '../publish/publish-confirm.util';
import {
  isAwaitingRecommendationsGate,
  isDeclineRecommendationsIntent,
} from '../gate/recommend-gate.util';
import { BuddyContextService } from './buddy-context.service';
import { MatchPostsFromChatUseCase } from './match-posts.use-case';
import type { PostIntentMatchResult } from './buddy.types';

export interface RecommendBeforeCreateParams {
  messages: ChatMessageDto[];
  input: string;
  activityLegacyId?: number;
  userId?: string;
  conversationState?: ConversationState | null;
  profileSync?: import('../agents/user-profile.agent').UserProfileSyncResult | null;
}

@Injectable()
export class RecommendBeforeCreateUseCase {
  constructor(
    private readonly matchPostsUseCase: MatchPostsFromChatUseCase,
    private readonly buddyContext: BuddyContextService,
  ) {}

  async execute(
    params: RecommendBeforeCreateParams,
  ): Promise<PostIntentMatchResult | null> {
    const { messages, input, activityLegacyId, userId, conversationState, profileSync } =
      params;
    if (activityLegacyId == null) return null;
    if (isPublishConfirmIntent(input.trim())) return null;
    if (isExplicitReplacePostIntent(input)) return null;
    if (isDeclineRecommendationsIntent(input)) return null;
    if (isAwaitingRecommendationsGate(messages, conversationState)) return null;
    if (isAwaitingPublishConfirmation(messages, conversationState)) return null;

    const ctx = parseConversationContext(messages, input);
    const trimmed = input.trim();

    const resolvedActivity = await this.buddyContext.resolveActivity(
      ctx,
      activityLegacyId,
    );
    if (!resolvedActivity?.legacyId) return null;

    const matchQuery = isAiShortcutTag(trimmed)
      ? `${resolvedActivity.name ?? '活动'} 组队 搭子 同行`
      : trimmed.length >= 2
        ? trimmed
        : `${resolvedActivity.name ?? '活动'} 组队 搭子`;

    const result = await this.matchPostsUseCase.execute({
      messages,
      input: matchQuery,
      activityLegacyId: resolvedActivity.legacyId,
      userId,
      fromIntentRouter: true,
      profileSync,
      preResolvedActivity: resolvedActivity,
    });

    return result;
  }
}
