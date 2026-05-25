import { resolveActivityId } from './ticket-draft.parser';

export interface TicketSearchParams {
  activityId?: string;
  activityKeyword?: string;
  type?: 'sell' | 'buy';
}

const CREATE_SELL_RE =
  /我有票要出|我要出票|发布出票|创建.*出票|我要卖票|我要出售|转让票|挂单出票/;
const CREATE_BUY_RE = /我要收票|发布求购|创建.*收票|我要求购/;
const SEARCH_RE =
  /查.*票|搜索.*票|有没有.*票|有.*票.*吗|什么票|哪些票|在售|在卖|出票中|收票中|票价|多少钱|谁有票|看看票|门票情况|平台.*票|帮我找.*票|想买.*票|购票|买票|求票|转票.*吗/;

/** 用户是在查询门票挂单，而不是创建挂单 */
export function isTicketSearchQuery(input: string): boolean {
  const text = input.trim();
  if (!text || /^\d+$/.test(text)) return false;
  if (CREATE_SELL_RE.test(text) || CREATE_BUY_RE.test(text)) return false;
  if (/联系方式|微信|手机号|电话.*出票|确认以下/.test(text)) return false;

  if (SEARCH_RE.test(text)) return true;

  if (/门票|票价/.test(text) && resolveActivityId(text)) {
    return !CREATE_SELL_RE.test(text) && !CREATE_BUY_RE.test(text);
  }

  return false;
}

export function parseTicketSearchParams(input: string): TicketSearchParams {
  const text = input.trim();
  const activityId = resolveActivityId(text);
  let activityKeyword: string | undefined;

  if (!activityId) {
    const keywordMatch = text.match(
      /(?:edc|s2o|ultra|tomorrowland|电音节|泰国)[^\s，,。]{0,20}/i,
    );
    activityKeyword = keywordMatch?.[0]?.trim() || text.slice(0, 40).trim();
  }

  return {
    activityId,
    activityKeyword,
    type: parseTicketSearchType(text),
  };
}

function parseTicketSearchType(text: string): 'sell' | 'buy' | undefined {
  if (/收票|求购|谁要票|有人收|收票中/.test(text) && !/买票|购票|想买/.test(text)) {
    return 'buy';
  }
  if (/出票|在卖|出售|转让|卖票|出票中/.test(text)) {
    return 'sell';
  }
  if (/买|购|想买|有没有卖|谁有票|有没有出/.test(text)) {
    return 'sell';
  }
  return undefined;
}
