import type {
  RecommendedActivityCard,
  RecommendedPostCard,
} from './chat-cards.types';
import type {
  ConversationState,
  TravelGuideBudgetTier,
} from './conversation-state.types';
import type { ClientActionStreamEvent } from './client-action.types';
import type { ItineraryConflict, ItineraryDay } from '../itinerary/types';

export interface TravelGuideChatForm {
  departure: string;
  departureCity?: string;
  headcount: number;
  budgetTier: TravelGuideBudgetTier;
  selfDrive: boolean;
  accommodationNights: number;
}

/** WebSocket AI stream frames (`AiService.streamChat` → client). */
export type AiStreamEvent =
  | { type: 'delta'; content: string }
  | {
      type: 'message_complete';
      content: string;
      requestId?: string;
    }
  | {
      type: 'done';
      messageId?: string;
      sessionId?: string;
    }
  | {
      type: 'post_created';
      postId: string;
      activityLegacyId?: number;
      post?: RecommendedPostCard;
    }
  | {
      type: 'existing_post';
      postId: string;
      activityLegacyId?: number;
    }
  | {
      type: 'activity_recommendation';
      activity: RecommendedActivityCard;
    }
  | {
      type: 'suggested_replies';
      replies: string[];
    }
  | {
      type: 'conversation_patch';
      state: ConversationState;
    }
  | {
      type: 'travel_guide_ready';
      guideId: string;
      plan: Record<string, unknown>;
      form: TravelGuideChatForm;
    }
  | {
      type: 'travel_guide_job';
      jobId: string;
      guideId: string;
      activityLegacyId: number;
      form: TravelGuideChatForm;
    }
  | {
      type: 'itinerary_ready';
      itineraryId: string;
      activityLegacyId: number;
      selectedDjIds: string[];
      eventMeta: string;
      days: ItineraryDay[];
      conflicts: ItineraryConflict[];
      cached?: boolean;
    }
  | {
      type: 'personality_result_ready';
      resultId: string;
      tagline: string;
      primaryType: string;
      soulMatchDjName: string;
      result: Record<string, unknown>;
    }
  | {
      type: 'activity_registered';
      activityLegacyId: number;
      title?: string;
      attendees: number;
      alreadyRegistered?: boolean;
    }
  | {
      type: 'comment_added';
      postId: string;
      body: string;
    }
  | ClientActionStreamEvent
  | { type: 'error'; message: string };
