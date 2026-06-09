import { Injectable } from '@nestjs/common';
import {
  createIdleState,
  enterRecommendGateState,
  type ConversationState,
} from '../conversation';
import {
  buildRecommendGateEmptyReply,
  buildRecommendGateFoundReply,
  buildRequireBuddyPostFirstReply,
  RECOMMEND_GATE_SUGGESTED_REPLIES,
  REQUIRE_BUDDY_POST_SUGGESTED_REPLIES,
} from '../gate/recommend-gate.util';
import { enterCollectPostBodyState } from '../conversation';
import { PUBLISH_CONFIRM_SUGGESTED_REPLIES } from '../publish/publish-confirm.util';
import type { PostIntentCreateAttempt } from '../post-intent.service';
import { buildActivityEnterConfirmationReply } from '../utils/activity-enter.util';
import type {
  AiStreamEvent,
  RecommendedActivityCard,
  RecommendedPostCard,
} from '../../shared/chat';

export interface ReplySink {
  setReply: (text: string) => void;
  getReply: () => string;
  setState: (state: ConversationState) => void;
  getState: () => ConversationState;
}

/** Builds `AiStreamEvent` frames for WebSocket transport (name is historical). */
@Injectable()
export class AiStreamEventBuilder {
  withMessageComplete(
    events: AiStreamEvent[],
    replyText: string,
  ): AiStreamEvent[] {
    const content = replyText.trim();
    if (!content) return events;
    if (events.some((event) => event.type === 'message_complete')) {
      return events;
    }
    const hasDelta = events.some((event) => event.type === 'delta');
    if (!hasDelta) return events;
    return [...events, { type: 'message_complete', content }];
  }

  conversationPatchEvent(sink: ReplySink): AiStreamEvent {
    return { type: 'conversation_patch', state: sink.getState() };
  }

  recommendGateSuggestedRepliesEvent(): AiStreamEvent | null {
    if (!RECOMMEND_GATE_SUGGESTED_REPLIES.length) {
      return null;
    }
    return {
      type: 'suggested_replies',
      replies: [...RECOMMEND_GATE_SUGGESTED_REPLIES],
    };
  }

  publishConfirmSuggestedRepliesEvent(): AiStreamEvent {
    return {
      type: 'suggested_replies',
      replies: [...PUBLISH_CONFIRM_SUGGESTED_REPLIES],
    };
  }

  djInfoSuggestedRepliesEvent(replies: string[]): AiStreamEvent | null {
    const unique = [
      ...new Set(replies.map((reply) => reply.trim()).filter(Boolean)),
    ];
    if (!unique.length) {
      return null;
    }
    return {
      type: 'suggested_replies',
      replies: unique,
    };
  }

  buildActivityEnterEvents(
    sink: ReplySink,
    activity: RecommendedActivityCard,
  ): AiStreamEvent[] {
    const replyText = buildActivityEnterConfirmationReply(activity.title);
    sink.setReply(replyText);
    return [
      { type: 'delta', content: replyText },
      { type: 'activity_recommendation', activity },
    ];
  }

  buildRecommendGateFoundEvents(
    sink: ReplySink,
    activityLegacyId: number | undefined,
    activityLabel: string,
    postCards: RecommendedPostCard[],
    matchCount: number,
    degraded?: boolean,
  ): AiStreamEvent[] {
    const replyText = buildRecommendGateFoundReply(activityLabel, matchCount);
    sink.setReply(replyText);
    sink.setState(
      enterRecommendGateState({
        activityLegacyId,
        shownPostIds: postCards.map((card) => card.postId),
        empty: false,
      }),
    );
    const suggestedReplies = this.recommendGateSuggestedRepliesEvent();
    return [
      { type: 'delta', content: replyText },
      {
        type: 'post_recommendations',
        posts: postCards,
        degraded,
      },
      ...(suggestedReplies ? [suggestedReplies] : []),
      this.conversationPatchEvent(sink),
    ];
  }

  buildRequireBuddyPostFirstEvents(
    sink: ReplySink,
    activityLegacyId: number | undefined,
    activityLabel: string,
  ): AiStreamEvent[] {
    const replyText = buildRequireBuddyPostFirstReply(activityLabel);
    sink.setReply(replyText);
    sink.setState(
      enterCollectPostBodyState({
        activityLegacyId,
        fromSelfPost: true,
      }),
    );
    return [
      { type: 'delta', content: replyText },
      {
        type: 'suggested_replies',
        replies: [...REQUIRE_BUDDY_POST_SUGGESTED_REPLIES],
      },
      this.conversationPatchEvent(sink),
    ];
  }

  buildRecommendGateEmptyEvents(
    sink: ReplySink,
    activityLegacyId: number | undefined,
    activityLabel: string,
  ): AiStreamEvent[] {
    const replyText = buildRecommendGateEmptyReply(activityLabel);
    sink.setReply(replyText);
    sink.setState(
      enterRecommendGateState({
        activityLegacyId,
        shownPostIds: [],
        empty: true,
      }),
    );
    const suggestedReplies = this.recommendGateSuggestedRepliesEvent();
    return [
      { type: 'delta', content: replyText },
      ...(suggestedReplies ? [suggestedReplies] : []),
      this.conversationPatchEvent(sink),
    ];
  }

  eventsFromPostAttempt(
    postAttempt: PostIntentCreateAttempt,
    sink: ReplySink,
  ): AiStreamEvent[] {
    if (!postAttempt) return [];

    const patchIfNeeded = (): AiStreamEvent[] => {
      const state = sink.getState();
      return state.flow !== createIdleState().flow ||
        state.gate ||
        state.publishDraft
        ? [this.conversationPatchEvent(sink)]
        : [];
    };

    if (postAttempt.kind === 'created') {
      sink.setState(createIdleState());
      sink.setReply(postAttempt.replyText);
      return [
        {
          type: 'post_created',
          postId: postAttempt.postId,
          activityLegacyId: postAttempt.activityLegacyId,
          post: postAttempt.createdPost,
        },
        { type: 'delta', content: postAttempt.replyText },
        this.conversationPatchEvent(sink),
      ];
    }

    if (postAttempt.kind === 'existing_post') {
      sink.setReply(postAttempt.replyText);
      return [
        {
          type: 'existing_post',
          postId: postAttempt.postId,
          activityLegacyId: postAttempt.activityLegacyId,
        },
        { type: 'delta', content: postAttempt.replyText },
      ];
    }

    if (
      postAttempt.kind === 'rejected' ||
      postAttempt.kind === 'pending_confirmation'
    ) {
      sink.setReply(postAttempt.replyText);
      const events: AiStreamEvent[] = [
        { type: 'delta', content: postAttempt.replyText },
        ...patchIfNeeded(),
      ];
      if (postAttempt.kind === 'pending_confirmation') {
        events.push(this.publishConfirmSuggestedRepliesEvent());
      }
      return events;
    }

    return [];
  }
}
