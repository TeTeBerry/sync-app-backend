import { Injectable, Logger } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { LlmService } from '../llm/llm.service';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  formatActivityCatalogDayLabels,
  inferBuddySearchHintKind,
} from '../match/zone-buddy-search.util';
import type { ResolvedChatIntent } from './chat-intent.types';
import { resolveChatIntentFastPath } from './intent-router.rules';
import { logAiTurn } from '../utils/log-ai-turn.util';
import {
  buildIntentRouterSystemPrompt,
  buildIntentRouterUserPrompt,
  type IntentRouterActivityContext,
} from './intent-router.prompt';

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

interface CachedIntentEntry {
  result: ResolvedChatIntent;
  expiresAt: number;
}

const INTENT_CACHE_TTL_MS = 30_000;
const INTENT_CACHE_MAX_SIZE = 1000;

@Injectable()
export class IntentRouterService {
  private readonly logger = new Logger(IntentRouterService.name);
  private readonly intentCache = new Map<string, CachedIntentEntry>();

  constructor(
    private readonly llmService: LlmService,
    private readonly activityService: ActivityService,
  ) {}

  async resolve(params: IntentRouterInput): Promise<ResolvedChatIntent> {
    const startedAt = Date.now();
    const trimmed = params.input.trim();
    const cacheKey = this.buildCacheKey(params.sessionId, trimmed);

    if (cacheKey) {
      const cached = this.intentCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        const result = cached.result;
        this.logIntentResolve(params, result, Date.now() - startedAt);
        return result;
      }
      if (cached) {
        this.intentCache.delete(cacheKey);
      }
    }

    const activityMeta = await this.loadActivityMeta(params.activityLegacyId);

    const ruleHit = resolveChatIntentFastPath(trimmed, params);
    if (ruleHit) {
      this.storeCache(cacheKey, ruleHit);
      this.logIntentResolve(params, ruleHit, Date.now() - startedAt);
      return ruleHit;
    }

    const llmHit = await this.resolveByLlm(
      params.messages,
      trimmed,
      activityMeta,
    );
    if (llmHit) {
      this.storeCache(cacheKey, llmHit);
      this.logIntentResolve(params, llmHit, Date.now() - startedAt);
      return llmHit;
    }

    const fallback: ResolvedChatIntent = { kind: 'create_post', source: 'default' };
    this.storeCache(cacheKey, fallback);
    this.logIntentResolve(params, fallback, Date.now() - startedAt);
    return fallback;
  }

  private buildCacheKey(sessionId?: string, input?: string): string | null {
    const sid = sessionId?.trim();
    const text = input?.trim();
    if (!sid || !text) return null;
    return `${sid}:${text}`;
  }

  private storeCache(key: string | null, result: ResolvedChatIntent): void {
    if (!key) return;

    const now = Date.now();

    // LRU 驱逐：满时删除最久未访问的条目
    if (this.intentCache.size >= INTENT_CACHE_MAX_SIZE) {
      const firstKey = this.intentCache.keys().next().value;
      if (firstKey != null) {
        this.intentCache.delete(firstKey);
      }
    }

    this.intentCache.set(key, {
      result,
      expiresAt: now + INTENT_CACHE_TTL_MS,
    });
  }

  private logIntentResolve(
    params: IntentRouterInput,
    result: ResolvedChatIntent,
    latencyMs: number,
  ): void {
    logAiTurn(this.logger, {
      event: 'intent_router',
      requestId: params.requestId ?? 'unknown',
      sessionId: params.sessionId ?? 'unknown',
      intent: result.kind,
      intentSource: result.source,
      ms_intent: latencyMs,
    });
  }

  private async loadActivityMeta(
    activityLegacyId?: number,
  ): Promise<IntentRouterActivityContext | undefined> {
    if (activityLegacyId == null || Number.isNaN(activityLegacyId)) {
      return undefined;
    }
    const activity = await this.activityService.findByLegacyId(activityLegacyId);
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
      .slice(-6)
      .map(m => `[${m.role}] ${m.content.trim()}`)
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
      const hintLabel = parsed.searchHint?.trim() || trimmed;
      const kind = inferBuddySearchHintKind(hintLabel);
      return {
        kind: 'search_posts',
        source: 'llm',
        buddySearchHint: { displayLabel: hintLabel, kind },
      };
    }

    if (
      intent === 'create_post' ||
      intent === 'legacy_cascade' ||
      intent === 'chitchat'
    ) {
      return { kind: 'create_post', source: 'llm' };
    }

    if (intent === 'quick_find_buddy' || intent === 'near_events') {
      return { kind: 'quick_reply', source: 'llm' };
    }

    return { kind: 'create_post', source: 'llm' };
  }
}
