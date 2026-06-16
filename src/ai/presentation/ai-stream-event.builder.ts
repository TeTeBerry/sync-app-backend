import { Injectable } from '@nestjs/common';
import { buildActivityEnterConfirmationReply } from '../utils/activity-enter.util';
import type { AiStreamEvent, RecommendedActivityCard } from '../../shared/chat';
import type { ConversationState } from '../conversation';

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
}
