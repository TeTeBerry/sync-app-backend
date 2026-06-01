import { ChatMessageDto } from '../../shared/chat';
import {
  RECOMMEND_GATE_MARKER,
  SELF_POST_COLLECT_BODY_MARKER,
} from '../gate/recommend-gate.util';
import {
  extractDraftBodyFromPublishConfirmContent,
  PUBLISH_CONFIRM_PROMPT_MARKER,
} from '../publish/publish-confirm.util';
import {
  createIdleState,
  enterCollectPostBodyState,
  enterPublishConfirmState,
  enterRecommendGateState,
  type ConversationState,
} from '../../shared/chat/conversation-state.types';

function findLastAssistantMessage(
  messages: ChatMessageDto[],
): ChatMessageDto | undefined {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index].role === 'assistant') {
      return messages[index];
    }
  }
  return undefined;
}

/** One-time migration for legacy sessions that only have markers in assistant text. */
export function migrateConversationStateFromHistory(
  messages: ChatMessageDto[] = [],
): ConversationState {
  const lastAssistant = findLastAssistantMessage(messages);
  if (!lastAssistant?.content) {
    return createIdleState();
  }

  const content = lastAssistant.content;

  if (content.includes(RECOMMEND_GATE_MARKER)) {
    return enterRecommendGateState({});
  }

  if (content.includes(PUBLISH_CONFIRM_PROMPT_MARKER)) {
    const draftBody =
      extractDraftBodyFromPublishConfirmContent(content) ?? undefined;
    return enterPublishConfirmState({ draftBody });
  }

  if (content.includes(SELF_POST_COLLECT_BODY_MARKER)) {
    return enterCollectPostBodyState({});
  }

  return createIdleState();
}
