import { isTicketResaleIntent } from '../buddy/activity-scope-guard.util';
import { isBuddyPostEntryIntent } from '../publish/buddy-post-flow.util';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';
import { shouldBypassAgentForReadOnlyFastPath } from './read-only-fast-path.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { isAwaitingSelfPostBodyCollection } from '../publish/buddy-post-flow.util';
import type { ConversationState } from '../conversation';
import {
  isActiveItineraryTask,
  isActiveTravelGuideTask,
} from '../conversation';
import type { ChatMessageDto } from '@sync/chat-contracts';
import type { ChatRequestDto } from '../presentation/chat-request.dto';

export function isPostingFlowState(flow: ConversationState['flow']): boolean {
  return flow === 'collect_post_body' || flow === 'publish_confirm';
}

export function mustForceCreatePostIntent(
  input: string,
  state: ConversationState,
  messages: ChatMessageDto[],
): boolean {
  return (
    state.flow === 'collect_post_body' ||
    isAwaitingSelfPostBodyCollection(messages, state) ||
    isBuddyPostEntryIntent(input.trim())
  );
}

export function shouldBlockAgentForActivityInput(
  input: string,
  _activityLegacyId: number,
): boolean {
  return isTicketResaleIntent(input.trim());
}

export function resolveActivityScopedFastPath(
  trimmed: string,
  _activityLegacyId: number,
): ResolvedChatIntent | null {
  if (isTicketResaleIntent(trimmed)) {
    return { kind: 'create_post', source: 'rule' };
  }

  return null;
}

export function shouldRunAgentFirst(params: {
  agentEnabled: boolean;
  dto: ChatRequestDto;
  input: string;
  conversationState: ConversationState;
  routed?: ResolvedChatIntent;
  /** @deprecated Prefer `routed` */
  routedKind?: string;
}): boolean {
  if (!params.agentEnabled) {
    return false;
  }

  if (params.dto.image?.trim()) {
    return false;
  }

  if (isActiveTravelGuideTask(params.conversationState)) {
    return true;
  }

  if (isActiveItineraryTask(params.conversationState)) {
    return true;
  }

  const trimmed = params.input.trim();
  if (!trimmed) {
    return false;
  }

  if (shouldBypassAgentForReadOnlyFastPath(params.routed)) {
    return false;
  }

  const routedKind = params.routed?.kind ?? params.routedKind;
  if (routedKind === 'create_post' || routedKind === 'activity_enter') {
    return false;
  }

  if (isPostingFlowState(params.conversationState.flow)) {
    return false;
  }

  if (isPublishConfirmIntent(trimmed)) {
    return false;
  }

  if (isBuddyPostEntryIntent(trimmed)) {
    return false;
  }

  if (
    params.dto.activityLegacyId != null &&
    shouldBlockAgentForActivityInput(trimmed, params.dto.activityLegacyId)
  ) {
    return false;
  }

  return true;
}
