import { Injectable } from '@nestjs/common';
import { LlmService } from '../../../infra/llm/llm.service';
import {
  isConfidentRuleBuddySearchParse,
  parseBuddyPostSearchQuery,
  type BuddyPostSearchParsed,
} from '../utils/buddy-post-search.util';
import {
  buildBuddyPostSearchParseSystemPrompt,
  buildBuddyPostSearchParseUserPrompt,
  llmParseToBuddyPostSearchParsed,
  type LlmBuddyPostSearchParseResult,
} from './buddy-post-search-parse.prompt';

export type BuddyPostSearchParseSource = 'rule' | 'llm';

export type BuddyPostSearchParseOutcome = {
  parsed: BuddyPostSearchParsed;
  source: BuddyPostSearchParseSource;
};

const BUDDY_SEARCH_LLM_TIMEOUT_MS = 5_000;

@Injectable()
export class BuddyPostSearchParseService {
  constructor(private readonly llmService: LlmService) {}

  async parse(query: string): Promise<BuddyPostSearchParseOutcome> {
    const trimmed = query.trim();
    if (!trimmed) {
      return { parsed: {}, source: 'rule' };
    }

    const ruleParsed = parseBuddyPostSearchQuery(trimmed);

    if (isConfidentRuleBuddySearchParse(trimmed, ruleParsed)) {
      return { parsed: ruleParsed, source: 'rule' };
    }

    const llmParsed = await this.tryLlmParse(trimmed);
    if (llmParsed) {
      return { parsed: llmParsed, source: 'llm' };
    }

    return { parsed: ruleParsed, source: 'rule' };
  }

  /** Explicit LLM parse for zero-result retry after a confident rule parse. */
  async tryLlmParse(query: string): Promise<BuddyPostSearchParsed | null> {
    if (!this.llmService.enabled) return null;

    const llmParsed =
      await this.llmService.invokeJson<LlmBuddyPostSearchParseResult>(
        buildBuddyPostSearchParseSystemPrompt(),
        buildBuddyPostSearchParseUserPrompt(query),
        BUDDY_SEARCH_LLM_TIMEOUT_MS,
        { reasoningEffort: 'no_think' },
      );
    return llmParseToBuddyPostSearchParsed(llmParsed);
  }
}
