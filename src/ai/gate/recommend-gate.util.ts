import type { ConversationState } from '../conversation';
import { ChatMessageDto } from '../presentation/chat-message.dto';

/** 助手已展示搭子推荐、等待用户决定是否自己发帖 */
export const RECOMMEND_GATE_MARKER = '【先推荐搭子】';

export const RECOMMEND_GATE_SUGGESTED_REPLIES = ['自己发帖'] as const;

/** 助手已请用户填写组队帖正文，等待下一条用户消息 */
export const SELF_POST_COLLECT_BODY_MARKER = '【填写组队帖】';

const DECLINE_RECOMMEND_RE =
  /^(自己发帖|发一条|发组队帖|没有合适的|没有合适|都不合适|不合适|不想用推荐|不想匹配|继续发帖|自己发|我来发帖)/;

export function isDeclineRecommendationsIntent(input: string): boolean {
  return DECLINE_RECOMMEND_RE.test(input.trim());
}

export function isAwaitingRecommendationsGate(
  messages: ChatMessageDto[],
  state?: ConversationState | null,
): boolean {
  if (state?.flow === 'recommend_gate') {
    return true;
  }

  const lastIndex = messages.length - 1;
  if (lastIndex < 1) return false;

  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') {
      return message.content.includes(RECOMMEND_GATE_MARKER);
    }
    if (message.role === 'user') {
      return false;
    }
  }

  return false;
}

/** Short assistant text when post cards carry the details (no numbered list in bubble). */
export function buildMatchRecommendCardsIntro(
  activityLabel: string,
  matchCount: number,
  scopeLabel?: string,
): string {
  const scope = scopeLabel?.trim();
  return scope
    ? `在「${activityLabel}」找到 ${matchCount} 条与${scope}相关的组队帖，点下方卡片查看：`
    : `在「${activityLabel}」找到 ${matchCount} 条相近组队帖，点下方卡片查看：`;
}

export function buildRecommendGateFoundReply(
  activityLabel: string,
  matchCount: number,
): string {
  return [
    RECOMMEND_GATE_MARKER,
    `在「${activityLabel}」找到 ${matchCount} 条可能合适的组队帖，先看看是否想加入：`,
    '',
    '若都不合适，回复「自己发帖」，我再帮你发一条招募帖。',
  ].join('\n');
}

export function isAwaitingSelfPostBodyCollection(
  messages: ChatMessageDto[],
  state?: ConversationState | null,
): boolean {
  if (state?.flow === 'collect_post_body') {
    return true;
  }

  const lastIndex = messages.length - 1;
  if (lastIndex < 1) return false;

  for (let index = lastIndex - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === 'assistant') {
      return message.content.includes(SELF_POST_COLLECT_BODY_MARKER);
    }
    if (message.role === 'user') {
      return false;
    }
  }

  return false;
}

export function buildDeclineRecommendCollectBodyReply(activityLabel: string): string {
  return `想发什么直接说，我帮你发～`;
}

export function buildRecommendGateEmptyReply(activityLabel: string): string {
  return [
    RECOMMEND_GATE_MARKER,
    `暂未在「${activityLabel}」找到相近的组队帖。`,
    '',
    '想发什么直接说，我帮你发～',
  ].join('\n');
}
