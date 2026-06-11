import { Injectable, Logger } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { LlmService } from '../../infra/llm/llm.service';
import { ChatMessageDto } from '../../shared/chat';
import { formatActivityCatalogDayLabels } from '../utils/activity-catalog-days.util';
import type { ResolvedChatIntent } from './chat-intent.types';
import { resolveChatIntentFastPath } from './intent-router.rules';
import { logAiTurn } from '../utils/log-ai-turn.util';
import {
  buildIntentRouterSystemPrompt,
  buildIntentRouterUserPrompt,
  type IntentRouterActivityContext,
} from './intent-router.prompt';
import { IntentCacheService } from './intent-cache.service';

export interface IntentRouterInput {
  messages: ChatMessageDto[];
  input: string;
  activityLegacyId?: number;
  image?: string;
  sessionId?: string;
  requestId?: string;
}

interface LlmIntentRouteResult {
  intent?: string;
  searchHint?: string;
}

@Injectable()
export class IntentRouterService {
  private readonly logger = new Logger(IntentRouterService.name);

  constructor(
    private readonly llmService: LlmService,
    private readonly activityService: ActivityService,
    private readonly intentCache: IntentCacheService,
  ) {}

  async resolve(params: IntentRouterInput): Promise<ResolvedChatIntent> {
    const startedAt = Date.now();
    const trimmed = params.input.trim();
    const cacheKey = this.intentCache.buildKey({
      sessionId: params.sessionId,
      input: trimmed,
      activityLegacyId: params.activityLegacyId,
      hasImage: Boolean(params.image?.trim()),
    });

    const cached = await this.intentCache.get(cacheKey);
    if (cached) {
      this.logIntentResolve(
        params,
        cached.result,
        Date.now() - startedAt,
        cached.layer,
      );
      return cached.result;
    }

    const ruleHit = resolveChatIntentFastPath(trimmed, params);
    if (ruleHit) {
      await this.intentCache.set(cacheKey, ruleHit);
      this.logIntentResolve(params, ruleHit, Date.now() - startedAt, 'miss');
      return ruleHit;
    }

    const activityMeta = await this.loadActivityMeta(params.activityLegacyId);

    const llmHit = await this.resolveByLlm(
      params.messages,
      trimmed,
      activityMeta,
    );
    if (llmHit) {
      await this.intentCache.set(cacheKey, llmHit);
      this.logIntentResolve(params, llmHit, Date.now() - startedAt, 'miss');
      return llmHit;
    }

    const fallback: ResolvedChatIntent = {
      kind: 'create_post',
      source: 'default',
    };
    await this.intentCache.set(cacheKey, fallback);
    this.logIntentResolve(params, fallback, Date.now() - startedAt, 'miss');
    return fallback;
  }

  private logIntentResolve(
    params: IntentRouterInput,
    result: ResolvedChatIntent,
    latencyMs: number,
    intentCache: 'redis' | 'memory' | 'miss',
  ): void {
    logAiTurn(this.logger, {
      event: 'intent_router',
      requestId: params.requestId ?? 'unknown',
      sessionId: params.sessionId ?? 'unknown',
      intent: result.kind,
      intentSource: result.source,
      intentCache,
      ms_intent: latencyMs,
    });
  }

  private async loadActivityMeta(
    activityLegacyId?: number,
  ): Promise<IntentRouterActivityContext | undefined> {
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      return undefined;
    }
    const activity =
      await this.activityService.findByLegacyId(activityLegacyId);
    if (!activity) return undefined;
    return {
      name: activity.name,
      date: activity.date,
      eventDaysLabel: formatActivityCatalogDayLabels(
        activity.date,
        activity.name,
      ),
    };
  }

  private async resolveByLlm(
    messages: ChatMessageDto[],
    trimmed: string,
    activityMeta?: IntentRouterActivityContext,
  ): Promise<ResolvedChatIntent | null> {
    if (!this.llmService.enabled || !trimmed) return null;

    const contextLines = messages
      .slice(-6) // aligned with CHAT_LLM_CONTEXT_TURNS
      .map((m) => `[${m.role}] ${m.content.trim()}`)
      .join('\n');

    const parsed = await this.llmService.invokeJson<LlmIntentRouteResult>(
      buildIntentRouterSystemPrompt(),
      buildIntentRouterUserPrompt({
        trimmed,
        contextLines,
        activity: activityMeta,
      }),
    );

    if (!parsed?.intent) return null;

    const intent = parsed.intent.trim().toLowerCase();

    if (intent === 'search_posts') {
      return { kind: 'quick_reply', source: 'llm' };
    }

    if (intent === 'create_post' || intent === 'legacy_cascade') {
      return { kind: 'create_post', source: 'llm' };
    }

    if (
      intent === 'chitchat' ||
      intent === 'quick_find_buddy' ||
      intent === 'near_events'
    ) {
      return { kind: 'quick_reply', source: 'llm' };
    }

    if (intent === 'dj_info') {
      return { kind: 'dj_info', source: 'llm' };
    }

    return { kind: 'create_post', source: 'llm' };
  }
}
