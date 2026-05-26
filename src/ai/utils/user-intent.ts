import { isAiShortcutTag } from '../../common/utils/demo-owner.util';

export type UserIntent =
  | 'find_buddy'
  | 'near_events'
  | 'general';

const QUICK_REPLIES: Record<UserIntent, string> = {
  find_buddy: '帮我组队',
  near_events: '查最近活动',
  general: '',
};

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
        '只追问：活动名称、出行日期、出发城市、同行人数。',
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
