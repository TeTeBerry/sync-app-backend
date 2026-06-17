import type { ConversationState } from '../conversation';
import { ChatMessageDto } from '../../shared/chat';

/** 助手已请用户填写组队帖正文，等待下一条用户消息 */
export const SELF_POST_COLLECT_BODY_MARKER = '【填写组队帖】';

/** 用户尚未发布帖子，需先填写模板信息 */
export const REQUIRE_BUDDY_POST_MARKER = '【先填写组队信息】';

export const REQUIRE_BUDDY_POST_SUGGESTED_REPLIES = ['组队发帖'] as const;

const BUDDY_POST_ENTRY_RE =
  /^(发一条|发组队帖|组队发帖|没有合适的|没有合适|都不合适|不合适|不想用推荐|继续发帖)/;

export function isBuddyPostEntryIntent(input: string): boolean {
  return BUDDY_POST_ENTRY_RE.test(input.trim());
}

export function isAwaitingSelfPostBodyCollection(
  _messages: ChatMessageDto[],
  state?: ConversationState | null,
): boolean {
  return state?.flow === 'collect_post_body';
}

export function buildCollectPostBodyPromptReply(
  _activityLabel: string,
): string {
  return '想发什么直接说，我帮你发～';
}

export function buildRequireBuddyPostFirstReply(activityLabel: string): string {
  return [
    REQUIRE_BUDDY_POST_MARKER,
    `在「${activityLabel}」发帖前，请先填写你的组队信息，方便他人了解你的需求。`,
    '',
    '可点下方「组队发帖」用表单填写，或直接发：时间、地点、人数（如 6.13-6.14 上海 2人 拼房）。',
  ].join('\n');
}
