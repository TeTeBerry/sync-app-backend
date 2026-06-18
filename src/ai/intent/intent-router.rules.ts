import { isBuddyPostEntryIntent } from '../publish/buddy-post-flow.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import {
  isActivityEnterNameInput,
  isAwaitingActivityEnterSelection,
} from '../utils/activity-enter.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import { resolveActivityScopedFastPath } from '../policy/chat-turn-policy';
import { resolveReadOnlyActivityFastPath } from '../policy/read-only-fast-path.util';
import type { IntentRouterInput } from './intent-router.service';
import type { ResolvedChatIntent } from './chat-intent.types';

/** 规则快路径：命中则不调用 Intent LLM */
export function resolveChatIntentFastPath(
  trimmed: string,
  params: IntentRouterInput,
): ResolvedChatIntent | null {
  if (
    params.activityLegacyId == null &&
    isAwaitingActivityEnterSelection(params.messages)
  ) {
    if (isActivityEnterNameInput(trimmed)) {
      return { kind: 'activity_enter', source: 'rule' };
    }
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
    const readOnly = resolveReadOnlyActivityFastPath(
      trimmed,
      params.activityLegacyId,
      params.conversationState ?? { version: 1, flow: 'idle' },
    );
    if (readOnly) {
      return readOnly;
    }

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
