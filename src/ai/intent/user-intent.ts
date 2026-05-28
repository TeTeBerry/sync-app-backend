import { isAiShortcutTag } from '../../common/utils/demo-owner.util';
import { isHomeFestivalShortcutInput } from '../utils/festival-shortcut.util';

export type UserIntent =
  | 'find_buddy'
  | 'near_events'
  | 'general';

const QUICK_REPLIES: Record<UserIntent, string> = {
  find_buddy: '帮我组队',
  near_events: '查最近活动',
  general: '',
};

/** 用户想搜现有组队帖（非新发帖） */
export function isSearchExistingPostsIntent(input: string): boolean {
  return /有没有|匹配|看看|推荐|找一下|现有|已有|结伴帖|组队帖|类似的|相似的|搜一下|查一下|帮我找/.test(
    input.trim(),
  );
}

export function detectUserIntent(input: string): UserIntent {
  const text = input.trim();

  if (
    isAiShortcutTag(text) ||
    text === QUICK_REPLIES.find_buddy ||
    text === '帮我找搭子' ||
    /找.*搭子|找伙伴|匹配搭子|组局|帮我结伴|帮我组队|找同行|结伴|组队/.test(text)
  ) {
    return 'find_buddy';
  }
  if (text === QUICK_REPLIES.near_events || /最近活动|查活动|有什么活动|近期活动/.test(text)) {
    return 'near_events';
  }

  return 'general';
}

export function isExactQuickReply(input: string): boolean {
  const text = input.trim();
  if (text === '帮我dd') return true;
  if (isHomeFestivalShortcutInput(text)) return true;
  return Object.values(QUICK_REPLIES).some(reply => reply && reply === text);
}

export function isQuickReplyIntent(input: string): boolean {
  if (isExactQuickReply(input)) return true;
  const intent = detectUserIntent(input);
  return intent === 'find_buddy' || intent === 'near_events';
}

export function buildIntentGuidance(intent: UserIntent): string {
  switch (intent) {
    case 'find_buddy':
      return [
        '【当前意图：组队/找同行】',
        '帮用户匹配同行伙伴或推荐活动，不是票务交易。',
        '只追问：活动名称、出行时间、人数、性别偏好。',
      ].join('\n');
    case 'near_events':
      return [
        '【当前意图：查活动】',
        '列出平台近期/热门活动；简要介绍后询问用户感兴趣的活动。',
      ].join('\n');
    default:
      return [
        '根据用户最新一条消息判断意图；切换话题时不要重复上一轮相同格式的追问。',
        '组队/找同行与查活动使用不同追问方式，勿混用模板。',
      ].join('\n');
  }
}
