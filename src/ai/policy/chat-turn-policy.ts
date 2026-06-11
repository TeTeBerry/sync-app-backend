import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { isTicketResaleIntent } from '../buddy/activity-scope-guard.util';
import { isDeclineRecommendationsIntent } from '../gate/recommend-gate.util';
import {
  isInformalPostBodyInput,
  isExplicitReplacePostIntent,
} from '../conversation/existing-post-guidance.util';
import { isDjInfoIntent } from '../dj/dj-info-query.util';
import { detectUserIntent } from '../intent/user-intent';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';
import { inferBuddySearchHintKind } from '../utils/buddy-search-hint.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { isActivityBriefIntent } from '../utils/activity-brief-intent.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import { isTravelGuideIntent } from '../utils/activity-guide.util';
import { shouldSkipActivityScopedBuddyRecommend } from '../buddy/activity-scope-guard.util';
import { isAwaitingSelfPostBodyCollection } from '../gate/recommend-gate.util';
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
    isDeclineRecommendationsIntent(input.trim())
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
  activityLegacyId: number,
): boolean {
  const trimmed = input.trim();
  if (isAiShortcutTag(trimmed)) {
    return true;
  }
  if (isTicketResaleIntent(trimmed)) {
    return true;
  }
  if (inferBuddySearchHintKind(trimmed)) {
    return true;
  }
  if (/(有人吗|有没有人|有没有\s*搭子|组队帖|结伴帖)/.test(trimmed)) {
    return true;
  }
  if (/帮我看看有没有|搜一下.*帖/.test(trimmed)) {
    return true;
  }
  if (detectUserIntent(trimmed) === 'find_buddy') {
    return true;
  }
  if (isInformalPostBodyInput(trimmed)) {
    return true;
  }
  return false;
}

export function resolveActivityScopedFastPath(
  trimmed: string,
  activityLegacyId: number,
): ResolvedChatIntent | null {
  if (isTicketResaleIntent(trimmed)) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (isInformalPostBodyInput(trimmed)) {
    return { kind: 'create_post', source: 'rule' };
  }

  const buddySearchKind = inferBuddySearchHintKind(trimmed);
  if (buddySearchKind && /(有人吗|有没有人|搭子)/.test(trimmed)) {
    return { kind: 'quick_reply', source: 'rule' };
  }

  if (detectUserIntent(trimmed) === 'find_buddy') {
    if (/(组队帖|结伴帖)/.test(trimmed)) {
      return null;
    }
    if (/(dj|艺人)/i.test(trimmed) && /(风格|曲风|类似|相近)/i.test(trimmed)) {
      return null;
    }
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

export function shouldSkipProactiveRecommend(params: {
  messages: ChatMessageDto[];
  input: string;
  effectiveActivityLegacyId: number | undefined;
  state: ConversationState;
}): boolean {
  const trimmed = params.input.trim();
  if (params.effectiveActivityLegacyId == null) {
    return true;
  }
  if (isTravelGuideIntent(trimmed)) {
    return true;
  }
  if (
    shouldSkipActivityScopedBuddyRecommend(
      trimmed,
      params.effectiveActivityLegacyId,
    )
  ) {
    return true;
  }
  if (isPublishConfirmIntent(trimmed)) {
    return true;
  }
  if (isExplicitReplacePostIntent(trimmed)) {
    return true;
  }
  if (isDeclineRecommendationsIntent(trimmed)) {
    return true;
  }
  if (isPostingFlowState(params.state.flow)) {
    return true;
  }
  if (isAwaitingSelfPostBodyCollection(params.messages, params.state)) {
    return true;
  }
  return false;
}
