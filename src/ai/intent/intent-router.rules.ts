import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { isPublishConfirmIntent } from '../publish/publish-confirm.util';
import {
  detectUserIntent,
  isSearchExistingPostsIntent,
} from '../intent/user-intent';
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

  if (isPublishConfirmIntent(trimmed)) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (isAiShortcutTag(trimmed) && params.activityLegacyId != null) {
    return { kind: 'create_post', source: 'rule' };
  }

  if (params.activityLegacyId != null && trimmed) {
    if (isSearchExistingPostsIntent(trimmed)) {
      const kind = inferBuddySearchHintKind(trimmed);
      return {
        kind: 'search_posts',
        source: 'rule',
        buddySearchHint: { displayLabel: trimmed, kind },
      };
    }

    if (detectUserIntent(trimmed) === 'find_buddy') {
      return { kind: 'create_post', source: 'rule' };
    }
  }

  return null;
}
