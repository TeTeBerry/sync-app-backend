import { Injectable } from '@nestjs/common';
import { LlmService } from '../../../infra/llm/llm.service';
import type { BuddyPostSearchParsed } from '../utils/buddy-post-search.util';
import {
  buildSearchTermsFromParsed,
  tokenizeRawBuddySearchQuery,
} from '../utils/buddy-post-search.util';

interface LlmBuddyPostSearchParseResult {
  eventName?: string;
  date?: string;
  genre?: string;
  peopleCount?: string;
  extraKeywords?: string[];
}

const BUDDY_POST_SEARCH_PARSE_SYSTEM = [
  '你是结伴帖检索助手，只做关键词拆解，不做推荐或排序。',
  '从用户自然语言需求中提取可用于全文检索的字段，输出 JSON：',
  '- eventName: 场次/活动名，如 EDC 韩国',
  '- date: 日期片段，如 10.3',
  '- genre: 曲风/风格，如 Techno',
  '- peopleCount: 人数数字字符串，如 2',
  '- extraKeywords: 其他有助于匹配的短语数组，如 白天、同逛舞台',
  '规则：',
  '- 只提取用户明确提到的信息，不要臆造',
  '- 不要把「找搭子」「检索」等服务性词语放进 extraKeywords',
  '- 不输出匹配度、推荐理由或排序建议',
].join('\n');

@Injectable()
export class BuddyPostSearchParseService {
  constructor(private readonly llmService: LlmService) {}

  async parse(query: string): Promise<BuddyPostSearchParsed> {
    const trimmed = query.trim();
    if (!trimmed) {
      return {};
    }

    if (!this.llmService.enabled) {
      return this.fallbackParse(trimmed);
    }

    const parsed =
      await this.llmService.invokeJson<LlmBuddyPostSearchParseResult>(
        BUDDY_POST_SEARCH_PARSE_SYSTEM,
        trimmed,
      );
    if (!parsed) {
      return this.fallbackParse(trimmed);
    }

    return this.normalize(parsed);
  }

  private normalize(
    parsed: LlmBuddyPostSearchParseResult,
  ): BuddyPostSearchParsed {
    const extraKeywords = (parsed.extraKeywords ?? [])
      .map((item) => item.trim())
      .filter(Boolean);

    return {
      eventName: parsed.eventName?.trim() || undefined,
      date: parsed.date?.trim() || undefined,
      genre: parsed.genre?.trim() || undefined,
      peopleCount: parsed.peopleCount?.trim() || undefined,
      extraKeywords: extraKeywords.length ? extraKeywords : undefined,
    };
  }

  private fallbackParse(query: string): BuddyPostSearchParsed {
    const peopleMatch = query.match(/(\d+)\s*(个|人|名)?/);
    const extraKeywords = tokenizeRawBuddySearchQuery(query);
    const parsed: BuddyPostSearchParsed = {
      peopleCount: peopleMatch?.[1],
      extraKeywords: extraKeywords.length ? extraKeywords : undefined,
    };

    if (!buildSearchTermsFromParsed(parsed).length) {
      return { extraKeywords: [query] };
    }

    return parsed;
  }
}
