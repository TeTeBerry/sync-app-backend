import { Injectable } from '@nestjs/common';
import { LlmService } from '../../../infra/llm/llm.service';
import {
  parseBuddyPostSearchQuery,
  type BuddyPostSearchParsed,
} from '../utils/buddy-post-search.util';
import {
  buildBuddyPostSearchParseSystemPrompt,
  buildBuddyPostSearchParseUserPrompt,
  llmParseToBuddyPostSearchParsed,
  type LlmBuddyPostSearchParseResult,
} from './buddy-post-search-parse.prompt';

@Injectable()
export class BuddyPostSearchParseService {
  constructor(private readonly llmService: LlmService) {}

  async parse(query: string): Promise<BuddyPostSearchParsed> {
    const trimmed = query.trim();
    if (!trimmed) return {};

    if (this.llmService.enabled) {
      const llmParsed =
        await this.llmService.invokeJson<LlmBuddyPostSearchParseResult>(
          buildBuddyPostSearchParseSystemPrompt(),
          buildBuddyPostSearchParseUserPrompt(trimmed),
          12_000,
        );
      const fromLlm = llmParseToBuddyPostSearchParsed(llmParsed);
      if (fromLlm) {
        return fromLlm;
      }
    }

    return parseBuddyPostSearchQuery(trimmed);
  }
}
