import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../modules/activity/activity.service';
import { LlmService } from '../llm/llm.service';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  formatActivityCatalogDayLabels,
  inferBuddySearchHintKind,
} from '../utils/zone-buddy-search.util';
import type { ResolvedChatIntent } from './chat-intent.types';
import { resolveChatIntentFastPath } from './intent-router.rules';
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
}

interface LlmIntentRouteResult {
  intent?: string;
  searchHint?: string;
}

@Injectable()
export class IntentRouterService {
  constructor(
    private readonly llmService: LlmService,
    private readonly activityService: ActivityService,
  ) {}

  async resolve(params: IntentRouterInput): Promise<ResolvedChatIntent> {
    const trimmed = params.input.trim();
    const activityMeta = await this.loadActivityMeta(params.activityLegacyId);

    const ruleHit = resolveChatIntentFastPath(trimmed, params);
    if (ruleHit) return ruleHit;

    const llmHit = await this.resolveByLlm(
      params.messages,
      trimmed,
      activityMeta,
    );
    if (llmHit) return llmHit;

    return { kind: 'legacy_cascade', source: 'default' };
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

    if (intent === 'create_post') {
      return { kind: 'create_post', source: 'llm' };
    }

    if (intent === 'quick_find_buddy' || intent === 'near_events') {
      return { kind: 'quick_reply', source: 'llm' };
    }

    return { kind: 'legacy_cascade', source: 'llm' };
  }
}
