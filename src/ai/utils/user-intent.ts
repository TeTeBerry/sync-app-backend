import { isTicketSearchQuery } from './ticket-search.util';

export type UserIntent =
  | 'find_buddy'
  | 'sell_ticket'
  | 'buy_ticket'
  | 'search_ticket'
  | 'near_events'
  | 'general';

const QUICK_REPLIES: Record<UserIntent, string> = {
  find_buddy: '帮我找搭子',
  sell_ticket: '我有票要出',
  buy_ticket: '我要收票',
  near_events: '查最近活动',
  search_ticket: '',
  general: '',
};

export function detectUserIntent(input: string): UserIntent {
  const text = input.trim();

  if (isTicketSearchQuery(text)) {
    return 'search_ticket';
  }
  if (text === QUICK_REPLIES.find_buddy || /找.*搭子|找伙伴|匹配搭子|组局/.test(text)) {
    return 'find_buddy';
  }
  if (
    text === QUICK_REPLIES.sell_ticket ||
    /^出票$/.test(text) ||
    /有票要出|我要出票|卖票|转票/.test(text)
  ) {
    return 'sell_ticket';
  }
  if (
    text === QUICK_REPLIES.buy_ticket ||
    /^收票$/.test(text) ||
    /求购|想买/.test(text)
  ) {
    return 'buy_ticket';
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
  return (
    intent === 'find_buddy' ||
    intent === 'sell_ticket' ||
    intent === 'buy_ticket' ||
    intent === 'near_events'
  );
}

export function buildIntentGuidance(intent: UserIntent): string {
  switch (intent) {
    case 'find_buddy':
      return [
        '【当前意图：找搭子】',
        '帮用户匹配同行伙伴或推荐开放拼单（酒店/交通等），不是门票出/收挂单。',
        '优先调用 queryPindan；无明确活动时展示若干热门拼单。',
        '只追问：活动名称、出行日期、出发城市、同行人数。',
        '禁止索要票种、出售单价、联系方式；禁止输出出票六要素清单。',
      ].join('\n');
    case 'sell_ticket':
      return [
        '【当前意图：出票】',
        '收集：活动、演出日期、票种、数量、单价、联系方式；齐全后复述并请确认，确认后调用 createTicketListing（type=sell）。',
      ].join('\n');
    case 'buy_ticket':
      return [
        '【当前意图：收票】',
        '收集：活动、日期、票种、数量、预算单价、联系方式；齐全后复述并请确认，确认后调用 createTicketListing（type=buy）。',
      ].join('\n');
    case 'search_ticket':
      return [
        '【当前意图：查询门票】',
        '用户想了解现有门票挂单或票价，不是创建挂单。',
        '必须先调用 searchTickets（必要时先 queryActivity 解析活动 code）。',
        '根据工具返回结果回答：活动、票种、数量、价格、出/收票类型；无结果时如实说明。',
        '禁止编造票价或挂单；禁止进入出票六要素收集流程。',
      ].join('\n');
    case 'near_events':
      return [
        '【当前意图：查活动】',
        '列出平台近期/热门活动（可用活动列表或 queryActivity）；简要介绍后询问用户感兴趣的活动。',
        '不要进入门票出/收信息收集流程。',
      ].join('\n');
    default:
      return [
        '根据用户最新一条消息判断意图；切换话题时不要重复上一轮相同格式的追问。',
        '找搭子/查活动/门票出收使用不同追问方式，勿混用模板。',
        '平台门票仅支持出票与收票，没有拼门票功能。',
      ].join('\n');
  }
}
