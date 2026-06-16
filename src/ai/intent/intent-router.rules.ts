import { isBuddyPostEntryIntent } from '../publish/buddy-post-flow.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import {
  isActivityEnterNameInput,
  isAwaitingActivityEnterSelection,
} from '../utils/activity-enter.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import { isTravelGuideIntent } from '../utils/activity-guide.util';
import { isActivityBriefIntent } from '../utils/activity-brief-intent.util';
import { isDjInfoIntent } from '../dj/dj-info-query.util';
import { resolveActivityScopedFastPath } from '../policy/chat-turn-policy';
import type { IntentRouterInput } from './intent-router.service';
import type { ResolvedChatIntent } from './chat-intent.types';

/** 规则快路径：命中则不调用 Intent LLM */
export function resolveChatIntentFastPath(
  trimmed: string,
  params: IntentRouterInput,
): ResolvedChatIntent | null {
  if (params.image?.trim()) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (
    params.activityLegacyId == null &&
    isAwaitingActivityEnterSelection(params.messages)
  ) {
    if (isActivityEnterNameInput(trimmed)) {
      return { kind: 'activity_enter', source: 'rule' };
    }
  }

  if (isTravelGuideIntent(trimmed) && params.activityLegacyId != null) {
    return { kind: 'quick_reply', source: 'rule' };
  }

  if (isDjInfoIntent(trimmed)) {
    return { kind: 'dj_info', source: 'rule' };
  }

  if (params.activityLegacyId != null && isActivityBriefIntent(trimmed)) {
    return { kind: 'quick_reply', source: 'rule' };
  }

  if (params.activityLegacyId == null && isHomeFestivalShortcutInput(trimmed)) {
    return { kind: 'quick_reply', source: 'rule' };
  }

  if (isPublishConfirmIntent(trimmed)) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (isBuddyPostEntryIntent(trimmed) && params.activityLegacyId != null) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (params.activityLegacyId != null && trimmed) {
    const activityScoped = resolveActivityScopedFastPath(
      trimmed,
      params.activityLegacyId,
    );
    if (activityScoped) {
      return activityScoped;
    }
  }

  return null;
}
