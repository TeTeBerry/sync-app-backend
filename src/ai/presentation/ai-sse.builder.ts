import { Injectable } from '@nestjs/common';
import {
  createIdleState,
  enterRecommendGateState,
  type ConversationState,
} from '../conversation';
import {
  buildRecommendGateEmptyReply,
  buildRecommendGateFoundReply,
  RECOMMEND_GATE_SUGGESTED_REPLIES,
} from '../gate/recommend-gate.util';
import type { PostIntentCreateAttempt } from '../post-intent.service';
import type { AiStreamEvent, RecommendedPostCard } from './ai-stream-event.view';

export interface ReplySink {
  setReply: (text: string) => void;
  getReply: () => string;
  setState: (state: ConversationState) => void;
  getState: () => ConversationState;
}

@Injectable()
export class AiSseBuilder {
  withMessageComplete(
    events: AiStreamEvent[],
    replyText: string,
  ): AiStreamEvent[] {
    const content = replyText.trim();
    if (!content) return events;
    if (events.some(event => event.type === 'message_complete')) {
      return events;
    }
    const hasDelta = events.some(event => event.type === 'delta');
    if (!hasDelta) return events;
    return [...events, { type: 'message_complete', content }];
  }

  conversationPatchEvent(sink: ReplySink): AiStreamEvent {
    return { type: 'conversation_patch', state: sink.getState() };
  }

  recommendGateSuggestedRepliesEvent(): AiStreamEvent {
    return {
      type: 'suggested_replies',
      replies: [...RECOMMEND_GATE_SUGGESTED_REPLIES],
    };
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
        shownPostIds: postCards.map(card => card.postId),
        empty: false,
      }),
    );
    return [
      { type: 'delta', content: replyText },
      {
        type: 'post_recommendations',
        posts: postCards,
        degraded,
      },
      this.recommendGateSuggestedRepliesEvent(),
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
    return [
      { type: 'delta', content: replyText },
      this.recommendGateSuggestedRepliesEvent(),
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
      return state.flow !== createIdleState().flow || state.gate || state.publishDraft
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
      if (
        postAttempt.kind === 'pending_confirmation' &&
        postAttempt.copyVariants?.length
      ) {
        events.push({
          type: 'buddy_copy_variants',
          variants: postAttempt.copyVariants,
        });
      }
      return events;
    }

    return [];
  }
}
