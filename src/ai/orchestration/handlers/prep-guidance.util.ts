import type { AiStreamEvent } from '@sync/chat-contracts';
import type { ConversationState } from '@sync/chat-contracts/conversation-state.types';

const BLOCKING_FLOW: ConversationState['flow'][] = [
  'collect_post_body',
  'publish_confirm',
];

const RICHER_EVENT_TYPES = new Set<AiStreamEvent['type']>([
  'suggested_replies',
  'client_action',
  'travel_guide_job',
  'travel_guide_ready',
  'itinerary_ready',
  'personality_result_ready',
  'post_created',
  'existing_post',
  'activity_recommendation',
  'activity_registered',
  'comment_added',
]);

export function shouldEmitPrepGuidance(params: {
  toolsUsed: string[];
  conversationState: ConversationState;
  events: AiStreamEvent[];
}): boolean {
  const { toolsUsed, conversationState, events } = params;

  if (toolsUsed.length > 0) {
    return false;
  }

  if (conversationState.activeTask) {
    return false;
  }

  if (BLOCKING_FLOW.includes(conversationState.flow)) {
    return false;
  }

  if (events.some((event) => RICHER_EVENT_TYPES.has(event.type))) {
    return false;
  }

  return true;
}
