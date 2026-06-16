import { isDjInfoIntent } from '../dj/dj-info-query.util';
import type { ConversationState } from '../conversation';
import type { ChatRequestDto } from '../presentation/chat-request.dto';
import { isActivityBriefIntent } from '../utils/activity-brief-intent.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';

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

export function shouldRunAgentFirst(params: {
  agentEnabled: boolean;
  dto: ChatRequestDto;
  input: string;
  conversationState: ConversationState;
}): boolean {
  if (!params.agentEnabled) {
    return false;
  }

  const trimmed = params.input.trim();
  if (!trimmed) {
    return false;
  }

  if (isReadOnlyTurn(trimmed, params.dto.activityLegacyId)) {
    return true;
  }

  return true;
}
