import type { ConversationState } from '../conversation';
import { ChatMessageDto } from '../../shared/chat';

/** 助手已展示搭子推荐、等待用户决定是否继续搜索或补充需求 */
export const RECOMMEND_GATE_MARKER = '【推荐搭子】';

export const RECOMMEND_GATE_SUGGESTED_REPLIES = [] as const;

/** 助手已请用户填写组队帖正文，等待下一条用户消息 */
export const SELF_POST_COLLECT_BODY_MARKER = '【填写组队帖】';

/** 用户尚未发布招募帖，需先填写组队信息再匹配他人帖 */
export const REQUIRE_BUDDY_POST_MARKER = '【先填写组队信息】';

export const REQUIRE_BUDDY_POST_SUGGESTED_REPLIES = ['组队发帖'] as const;

/** 无匹配结果时引导用户下一条消息作为发帖正文 */
export const MATCH_EMPTY_POST_BODY_PROMPT = '你可以：告诉我内容帮你发布帖子';

const DECLINE_RECOMMEND_RE =
  /^(发一条|发组队帖|没有合适的|没有合适|都不合适|不合适|不想用推荐|不想匹配|继续发帖)/;

export function isDeclineRecommendationsIntent(input: string): boolean {
  return DECLINE_RECOMMEND_RE.test(input.trim());
}

export function isAwaitingRecommendationsGate(
  _messages: ChatMessageDto[],
  state?: ConversationState | null,
): boolean {
  return state?.flow === 'recommend_gate';
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
    '若都不合适，可以告诉我你的具体需求，或点「组队发帖」填写。',
  ].join('\n');
}

export function isAwaitingSelfPostBodyCollection(
  _messages: ChatMessageDto[],
  state?: ConversationState | null,
): boolean {
  return state?.flow === 'collect_post_body';
}

export function buildDeclineRecommendCollectBodyReply(
  activityLabel: string,
): string {
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

export function buildRequireBuddyPostFirstReply(activityLabel: string): string {
  return [
    REQUIRE_BUDDY_POST_MARKER,
    `在「${activityLabel}」找同行前，请先填写你的组队信息，方便他人了解你的需求。`,
    '',
    '可点下方「组队发帖」用表单填写，或直接发：时间、地点、人数（如 6.13-6.14 上海 2人 拼房）。',
  ].join('\n');
}
