import type { ConversationState } from '../conversation';
import { ChatMessageDto } from '../../shared/chat';

/** 助手已请用户填写组队帖正文，等待下一条用户消息 */
export const SELF_POST_COLLECT_BODY_MARKER = '【填写组队帖】';

/** 用户尚未发布帖子，需先填写模板信息 */
export const REQUIRE_BUDDY_POST_MARKER = '【先填写组队信息】';

export const REQUIRE_BUDDY_POST_SUGGESTED_REPLIES = ['组队发帖'] as const;

export const COLLECT_POST_BODY_SUGGESTED_REPLIES = [
  '6.13-6.14 上海 2人 拼房',
] as const;

const BUDDY_POST_ENTRY_RE =
  /^(发一条|发组队帖|组队发帖|发帖|发个帖子|发帖子|帮我发帖|我要发帖|我想发帖|没有合适的|没有合适|都不合适|不合适|不想用推荐|继续发帖)/;

export function isBuddyPostEntryIntent(input: string): boolean {
  return BUDDY_POST_ENTRY_RE.test(input.trim());
}

export function isAwaitingSelfPostBodyCollection(
  _messages: ChatMessageDto[],
  state?: ConversationState | null,
): boolean {
  return state?.flow === 'collect_post_body';
}

function buildBuddyPostFieldGuideLines(activityLabel: string): string[] {
  return [
    `在「${activityLabel}」发帖前，请补充你的组队信息：`,
    '',
    '· 活动时间（如 6.13-6.14）',
    '· 出发地/集合点（如 上海、场馆北门）',
    '· 人数（如 2人）',
    '· 备注（可选）：性别偏好、音乐风格、组队类型等',
    '',
    '可直接一句话发送，例如：「6.13-6.14 上海 2人 拼房」',
    '也可点下方「组队发帖」用表单填写。',
  ];
}

export function buildCollectPostBodyPromptReply(activityLabel: string): string {
  return [
    SELF_POST_COLLECT_BODY_MARKER,
    ...buildBuddyPostFieldGuideLines(activityLabel),
  ].join('\n');
}

export function buildRequireBuddyPostFirstReply(activityLabel: string): string {
  return [
    REQUIRE_BUDDY_POST_MARKER,
    ...buildBuddyPostFieldGuideLines(activityLabel),
  ].join('\n');
}
