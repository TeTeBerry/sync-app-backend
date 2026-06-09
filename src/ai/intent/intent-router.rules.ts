import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { isTicketResaleIntent } from '../buddy/activity-scope-guard.util';
import { isDeclineRecommendationsIntent } from '../gate/recommend-gate.util';
import { isInformalPostBodyInput } from '../conversation/existing-post-guidance.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import { detectUserIntent } from '../intent/user-intent';
import {
  isActivityEnterNameInput,
  isAwaitingActivityEnterSelection,
} from '../utils/activity-enter.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';
import { isTravelGuideIntent } from '../utils/activity-guide.util';
import { isActivityBriefIntent } from '../utils/activity-brief-intent.util';
import { isDjInfoIntent } from '../dj/dj-info-query.util';
import { inferBuddySearchHintKind } from '../match/zone-buddy-search.util';
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

  if (
    isDeclineRecommendationsIntent(trimmed) &&
    params.activityLegacyId != null
  ) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (isAiShortcutTag(trimmed) && params.activityLegacyId != null) {
    return { kind: 'search_posts', source: 'rule' };
  }

  if (params.activityLegacyId != null && trimmed) {
    if (isTicketResaleIntent(trimmed)) {
      return { kind: 'create_post', source: 'rule' };
    }

    if (isInformalPostBodyInput(trimmed)) {
      return { kind: 'create_post', source: 'rule' };
    }

    const buddySearchKind = inferBuddySearchHintKind(trimmed);
    if (buddySearchKind && /(有人吗|有没有人|搭子)/.test(trimmed)) {
      return {
        kind: 'search_posts',
        source: 'rule',
        buddySearchHint: { displayLabel: trimmed, kind: buddySearchKind },
      };
    }

    if (detectUserIntent(trimmed) === 'find_buddy') {
      if (/(组队帖|结伴帖)/.test(trimmed)) {
        return null;
      }
      if (
        /(dj|艺人)/i.test(trimmed) &&
        /(风格|曲风|类似|相近)/i.test(trimmed)
      ) {
        return null;
      }
      return { kind: 'create_post', source: 'rule' };
    }
  }

  return null;
}
