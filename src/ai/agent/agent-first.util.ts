import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { isTicketResaleIntent } from '../buddy/activity-scope-guard.util';
import { isInformalPostBodyInput } from '../conversation/existing-post-guidance.util';
import { isDjInfoIntent } from '../dj/dj-info-query.util';
import { detectUserIntent } from '../intent/user-intent';
import { inferBuddySearchHintKind } from '../match/zone-buddy-search.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { isActivityBriefIntent } from '../utils/activity-brief-intent.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import type { ConversationState } from '../conversation';
import type { ChatRequestDto } from '../presentation/chat-request.dto';

/** P0 只读场景：优先 Agent，不受活动内搜帖/发帖启发式影响 */
function isReadOnlyAgentCandidate(
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

  const flow = params.conversationState.flow;
  if (flow === 'collect_post_body' || flow === 'publish_confirm') {
    return false;
  }

  const trimmed = params.input.trim();
  if (!trimmed) {
    return false;
  }

  if (isPublishConfirmIntent(trimmed)) {
    return false;
  }

  if (isReadOnlyAgentCandidate(trimmed, params.dto.activityLegacyId)) {
    return true;
  }

  if (params.dto.activityLegacyId != null) {
    if (isAiShortcutTag(trimmed)) {
      return false;
    }
    if (isTicketResaleIntent(trimmed)) {
      return false;
    }
    if (inferBuddySearchHintKind(trimmed)) {
      return false;
    }
    if (/(有人吗|有没有人|有没有\s*搭子|组队帖|结伴帖)/.test(trimmed)) {
      return false;
    }
    if (/帮我看看有没有|搜一下.*帖/.test(trimmed)) {
      return false;
    }
    if (detectUserIntent(trimmed) === 'find_buddy') {
      return false;
    }
    if (isInformalPostBodyInput(trimmed)) {
      return false;
    }
  }

  return true;
}
