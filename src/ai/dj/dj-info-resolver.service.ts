import { Injectable, Logger } from '@nestjs/common';
import { LlmService } from '../../infra/llm/llm.service';
import { applyDjConversationAnchor } from './dj-info-query.util';
import { normalizeStructuredDjQuery } from './dj-info-structured.util';
import {
  buildDjInfoResolverSystemPrompt,
  buildDjInfoResolverUserPrompt,
  type LlmDjInfoResolveResult,
} from './dj-info-resolver.prompt';
import type { DjInfoStructuredQuery } from './dj-info-structured.types';
import type { ChatMessageDto } from '@sync/chat-contracts';

@Injectable()
export class DjInfoResolverService {
  private readonly logger = new Logger(DjInfoResolverService.name);

  constructor(private readonly llmService: LlmService) {}

  async resolve(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
    toolArgs?: Record<string, unknown>;
  }): Promise<DjInfoStructuredQuery> {
    if (this.llmService.enabled) {
      const llmQuery = await this.resolveWithLlm(params);
      if (llmQuery) {
        return applyDjConversationAnchor(
          llmQuery,
          params.messages,
          params.input,
        );
      }
    }

    const fromToolArgs = normalizeStructuredDjQuery(
      params.toolArgs ?? {},
      params.activityLegacyId,
    );
    if (fromToolArgs) {
      return applyDjConversationAnchor(
        fromToolArgs,
        params.messages,
        params.input,
      );
    }

    return {
      intent: 'lineup_overview',
      styles: [],
      scope:
        params.activityLegacyId != null &&
        !Number.isNaN(params.activityLegacyId)
          ? 'lineup'
          : 'catalog',
    };
  }

  private async resolveWithLlm(params: {
    messages: ChatMessageDto[];
    input: string;
    activityLegacyId?: number;
    toolArgs?: Record<string, unknown>;
  }): Promise<DjInfoStructuredQuery | null> {
    const parsed = await this.llmService.invokeJson<LlmDjInfoResolveResult>(
      buildDjInfoResolverSystemPrompt(),
      buildDjInfoResolverUserPrompt(params),
      12_000,
    );

    if (!parsed?.intent) {
      return null;
    }

    const normalized = normalizeStructuredDjQuery(
      parsed as Record<string, unknown>,
      params.activityLegacyId,
    );
    if (!normalized) {
      this.logger.warn(
        `dj resolver returned invalid intent: ${parsed.intent ?? 'empty'}`,
      );
      return null;
    }

    return normalized;
  }
}
