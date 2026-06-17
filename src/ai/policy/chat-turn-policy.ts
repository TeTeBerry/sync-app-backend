import { isTicketResaleIntent } from '../buddy/activity-scope-guard.util';
import { isBuddyPostEntryIntent } from '../publish/buddy-post-flow.util';
import { isDjInfoIntent } from '../dj/dj-info-query.util';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { isActivityBriefIntent } from '../utils/activity-brief-intent.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import { isAwaitingSelfPostBodyCollection } from '../publish/buddy-post-flow.util';
import type { ConversationState } from '../conversation';
import type { ChatMessageDto } from '../../shared/chat';
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

/** P0 只读场景：DJ / 首页音乐节 / 活动 FAQ */
export function isReadOnlyTurn(
  input: string,
  activityLegacyId?: number,
): boolean {
  const trimmed = input.trim();
  if (!trimmed) {
    return false;
  }
  if (isDjInfoIntent(trimmed)) {
    return true;
  }
  if (activityLegacyId == null && isHomeFestivalShortcutInput(trimmed)) {
    return true;
  }
  if (activityLegacyId != null && isActivityBriefIntent(trimmed)) {
    return true;
  }
  return false;
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
}): boolean {
  if (!params.agentEnabled) {
    return false;
  }

  if (params.dto.image?.trim()) {
    return false;
  }

  if (isPostingFlowState(params.conversationState.flow)) {
    return false;
  }

  const trimmed = params.input.trim();
  if (!trimmed) {
    return false;
  }

  if (isPublishConfirmIntent(trimmed)) {
    return false;
  }

  if (isBuddyPostEntryIntent(trimmed)) {
    return false;
  }

  if (isReadOnlyTurn(trimmed, params.dto.activityLegacyId)) {
    return true;
  }

  if (
    params.dto.activityLegacyId != null &&
    shouldBlockAgentForActivityInput(trimmed, params.dto.activityLegacyId)
  ) {
    return false;
  }

  return true;
}
