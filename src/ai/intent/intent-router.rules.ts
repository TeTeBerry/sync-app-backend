import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { isPublishConfirmIntent } from '../utils/publish-confirm.util';
import type { IntentRouterInput } from './intent-router.service';
import type { ResolvedChatIntent } from './chat-intent.types';

/** 规则快路径（仅 3 条）：命中则不调用 Intent LLM */
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

  return null;
}
