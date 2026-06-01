import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import type { ConversationState } from '../conversation';
import { ChatMessageDto } from '../../shared/chat';
import { parseConversationContext } from '../conversation/conversation-context.parser';
import { isExplicitReplacePostIntent } from '../conversation/existing-post-guidance.util';
import {
  isAwaitingPublishConfirmation,
  isPublishConfirmIntent,
} from '../publish/publish-confirm.util';
import {
  isAwaitingSelfPostBodyCollection,
  isDeclineRecommendationsIntent,
} from '../gate/recommend-gate.util';
import { buildMatchCriteriaForSearch } from '../match/buddy-match-criteria.util';
import { PostService } from '../../modules/partner/post.service';
import { BuddyContextService } from './buddy-context.service';
import { shouldSkipActivityScopedBuddyRecommend } from './activity-scope-guard.util';
import { MatchPostsFromChatUseCase } from './match-posts.use-case';
import type { PostIntentMatchResult } from './buddy.types';

export interface RecommendBeforeCreateParams {
  messages: ChatMessageDto[];
  input: string;
  activityLegacyId?: number;
  actor: RequestActor;
  conversationState?: ConversationState | null;
  profileSync?:
    | import('../agents/user-profile.agent').UserProfileSyncResult
    | null;
}

@Injectable()
export class RecommendBeforeCreateUseCase {
  constructor(
    private readonly matchPostsUseCase: MatchPostsFromChatUseCase,
    private readonly buddyContext: BuddyContextService,
    private readonly postService: PostService,
  ) {}

  async execute(
    params: RecommendBeforeCreateParams,
  ): Promise<PostIntentMatchResult | null> {
    const {
      messages,
      input,
      activityLegacyId,
      actor,
      conversationState,
      profileSync,
    } = params;
    if (activityLegacyId == null) return null;
    if (shouldSkipActivityScopedBuddyRecommend(input, activityLegacyId)) {
      return null;
    }
    if (isPublishConfirmIntent(input.trim())) return null;
    if (isExplicitReplacePostIntent(input)) return null;
    if (isDeclineRecommendationsIntent(input)) return null;
    if (isAwaitingPublishConfirmation(messages, conversationState)) return null;
    if (conversationState?.flow === 'collect_post_body') return null;
    if (isAwaitingSelfPostBodyCollection(messages, conversationState)) {
      return null;
    }

    const ctx = parseConversationContext(messages, input);
    const trimmed = input.trim();

    const resolvedActivity = await this.buddyContext.resolveActivity(
      ctx,
      activityLegacyId,
    );
    if (!resolvedActivity?.legacyId) return null;

    const ownerPost = actor.clientUserId
      ? await this.postService.findOwnerRecruitingPostRecord(
          resolvedActivity.legacyId,
          actor,
        )
      : null;

    const criteria = buildMatchCriteriaForSearch({
      activityLegacyId: resolvedActivity.legacyId,
      activityName: resolvedActivity.name,
      activityCode: resolvedActivity.code,
      activityDate: resolvedActivity.date,
      ownerPost,
      conversation: ctx,
      profileCity: profileSync?.profile?.city,
      userInput: trimmed,
    });

    return this.matchPostsUseCase.execute({
      messages,
      input: trimmed,
      activityLegacyId: resolvedActivity.legacyId,
      actor,
      fromIntentRouter: true,
      profileSync,
      preResolvedActivity: resolvedActivity,
      matchCriteria: criteria,
    });
  }
}
