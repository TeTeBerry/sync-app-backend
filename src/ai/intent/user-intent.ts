import { isTravelGuideIntent } from '../utils/activity-guide.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';

export type UserIntent = 'near_events' | 'general';

const QUICK_REPLIES: Record<UserIntent, string> = {
  near_events: '查最近活动',
  general: '',
};

export function detectUserIntent(input: string): UserIntent {
  const text = input.trim();

  if (
    text === QUICK_REPLIES.near_events ||
    /最近活动|查活动|有什么活动|近期活动/.test(text)
  ) {
    return 'near_events';
  }

  return 'general';
}

export function isExactQuickReply(input: string): boolean {
  const text = input.trim();
  if (isTravelGuideIntent(text)) return true;
  if (isHomeFestivalShortcutInput(text)) return true;
  return Object.values(QUICK_REPLIES).some((reply) => reply && reply === text);
}

export function isQuickReplyIntent(input: string): boolean {
  if (isExactQuickReply(input)) return true;
  return detectUserIntent(input) === 'near_events';
}

export function buildIntentGuidance(intent: UserIntent): string {
  switch (intent) {
    case 'near_events':
      return [
        '【当前意图：查活动】',
        '列出平台近期/热门活动；简要介绍后询问用户感兴趣的活动。',
      ].join('\n');
    default:
      return '根据用户最新一条消息判断意图；切换话题时不要重复上一轮相同格式的追问。';
  }
}
