import type { BuddyPostSearchParsed } from '../utils/buddy-post-search.util';

export interface LlmBuddyPostSearchParseResult {
  departureCity?: string;
  genre?: string;
  peopleCount?: string;
  date?: string;
  searchTerms?: string[];
}

export const BUDDY_POST_SEARCH_PARSE_FEW_SHOTS: Array<{
  input: string;
  output: LlmBuddyPostSearchParseResult;
}> = [
  {
    input: '找成都出发的队',
    output: {
      departureCity: '成都',
      searchTerms: ['成都', '出发'],
    },
  },
  {
    input: '找成都出发的',
    output: {
      departureCity: '成都',
      searchTerms: ['成都', '出发'],
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
    '你是公开招募帖检索条件解析器。从用户口语中提取用于筛选帖子的关键词。',
    '只输出 JSON，字段均可选：',
    '- departureCity: 出发城市',
    '- genre: 曲风/音乐风格',
    '- peopleCount: 人数数字',
    '- date: 日期片段',
    '- searchTerms: 用于正文匹配的关键词数组（勿含「找/队/招募帖/搭子」等口语外壳）',
    '',
    '要求：',
    '- searchTerms 每项 1-8 字，2-6 个为宜',
    '- 不要把用户整句原文作为一个 term',
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

  const searchTerms = (parsed.searchTerms ?? [])
    .map((term) => term?.trim())
    .filter((term): term is string => Boolean(term && term.length >= 1));

  const extraKeywords = [
    parsed.departureCity?.trim(),
    parsed.genre?.trim(),
    parsed.date?.trim(),
    parsed.peopleCount?.trim(),
    ...searchTerms,
  ].filter((term): term is string => Boolean(term));

  const uniqueKeywords = [...new Set(extraKeywords)];
  if (!uniqueKeywords.length) {
    return null;
  }

  return {
    date: parsed.date?.trim(),
    genre: parsed.genre?.trim(),
    peopleCount: parsed.peopleCount?.trim(),
    extraKeywords: uniqueKeywords,
  };
}
