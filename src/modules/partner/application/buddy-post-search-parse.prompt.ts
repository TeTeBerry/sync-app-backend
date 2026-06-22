import type { BuddyPostSearchParsed } from '../utils/buddy-post-search.util';
import { normalizeCityName } from '../utils/departure-city.util';

export interface LlmBuddyPostSearchParseResult {
  departureCity?: string;
  genre?: string;
  peopleCount?: string;
  date?: string;
  searchTerms?: string[];
  /** User wants to join a team still recruiting, not one already full. */
  preferOpenRecruit?: boolean;
}

export const BUDDY_POST_SEARCH_PARSE_FEW_SHOTS: Array<{
  input: string;
  output: LlmBuddyPostSearchParseResult;
}> = [
  {
    input: '找成都出发的队',
    output: {
      departureCity: '成都',
      searchTerms: [],
    },
  },
  {
    input: '杭州出发',
    output: {
      departureCity: '杭州',
      searchTerms: [],
    },
  },
  {
    input: '上海出发，喜欢 Techno，差 1 人',
    output: {
      departureCity: '上海',
      genre: 'Techno',
      peopleCount: '1',
      preferOpenRecruit: true,
      searchTerms: ['Techno'],
    },
  },
  {
    input: '上海出发，12.11-12.13，差 1 人',
    output: {
      departureCity: '上海',
      date: '12.11-12.13',
      peopleCount: '1',
      preferOpenRecruit: true,
      searchTerms: ['12.11', '12.13'],
    },
  },
  {
    input: '喜欢 Techno，同逛主舞台',
    output: {
      genre: 'Techno',
      searchTerms: ['Techno', '同逛', '主舞台'],
    },
  },
  {
    input: '10.3 白天在场，找 2 人',
    output: {
      date: '10.3',
      peopleCount: '2',
      searchTerms: ['10.3', '白天'],
    },
  },
];

export function buildBuddyPostSearchParseSystemPrompt(): string {
  const fewShotBlock = BUDDY_POST_SEARCH_PARSE_FEW_SHOTS.map(
    (ex, i) =>
      `示例${i + 1}:\n用户: ${ex.input}\n→ ${JSON.stringify(ex.output)}`,
  ).join('\n\n');

  return [
    '你是公开招募帖检索条件解析器。用户用口语描述想找的帖子，你提取结构化筛选条件。',
    '',
    '招募帖字段（帮助理解，不要编造）：',
    '- departureCity：出发城市，结构化字段，匹配帖子的出发地',
    '- body / tags：招募正文与标签，由 searchTerms 去匹配',
    '',
    '只输出 JSON，字段均可选：',
    '- departureCity: 出发城市名（只写城市，如「杭州」；用户说「杭州出发」时写 departureCity，不要把「出发」写进 searchTerms）',
    '- genre: 曲风/音乐风格',
    '- peopleCount: 人数数字（字符串）',
    '- date: 日期片段',
    '- searchTerms: 必须在帖子正文/标签里出现的检索词（2-6 个为宜，每项 1-8 字）',
    '- preferOpenRecruit: 布尔。用户想找「还能加入」的队伍时为 true。例如「差 N 人」「缺 N 人」「还缺人」「找队友加入」表示想找有空位的招募；「已满」「人齐了」「招满」是发帖方状态，不是检索意图',
    '',
    '原则：',
    '- 理解用户意图，拆成「结构化字段 + 正文关键词」，不要复制整句',
    '- 「差 N 人」= 用户想加入还差人的队 → preferOpenRecruit: true，peopleCount 写 N；不要把「已满」类帖子当成目标',
    '- searchTerms 只放帖子里可能写出的词：曲风、日期、人数、同逛/拼房/主舞台等',
    '- 不要把「找/队/搭子/招募/出发/公开」等口语外壳放进 searchTerms',
    '- 只有出发城市时，searchTerms 可以为空数组',
    fewShotBlock,
  ].join('\n');
}

export function buildBuddyPostSearchParseUserPrompt(query: string): string {
  return ['用户检索需求:', query.trim()].join('\n');
}

export function llmParseToBuddyPostSearchParsed(
  parsed: LlmBuddyPostSearchParseResult | null | undefined,
): BuddyPostSearchParsed | null {
  if (!parsed) return null;

  const result: BuddyPostSearchParsed = {};
  const departureCity =
    normalizeCityName(parsed.departureCity?.trim()) ??
    parsed.departureCity?.trim();
  if (departureCity) result.departureCity = departureCity;
  if (parsed.date?.trim()) result.date = parsed.date.trim();
  if (parsed.genre?.trim()) result.genre = parsed.genre.trim();
  if (parsed.peopleCount?.trim())
    result.peopleCount = parsed.peopleCount.trim();
  if (parsed.preferOpenRecruit === true) result.preferOpenRecruit = true;

  const searchTerms = [
    ...new Set(
      (parsed.searchTerms ?? [])
        .map((term) => term?.trim())
        .filter((term): term is string => Boolean(term && term.length >= 1)),
    ),
  ];
  if (searchTerms.length) {
    result.extraKeywords = searchTerms;
  }

  const hasSignal =
    result.departureCity ||
    result.date ||
    result.genre ||
    result.peopleCount ||
    result.preferOpenRecruit ||
    result.extraKeywords?.length;
  return hasSignal ? result : null;
}
