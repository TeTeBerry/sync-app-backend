import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ActivityService } from '../../modules/activity/activity.service';
import {
  AgentLlmService,
  parseToolCallArgs,
  type OpenAiChatMessage,
} from './agent-llm.service';
import { DjInfoResolverService } from '../dj/dj-info-resolver.service';
import { isActionableDjQuery } from './agent-dj-fallback.util';
import { shouldRunAgentFirst } from '../policy/chat-turn-policy';
import { buildAgentLlmMessages } from './agent-context.builder';
import { compareAgentShadow } from './agent-shadow.util';
import type {
  ChatAgentMode,
  ChatAgentShadowComparison,
  ChatAgentTurnInput,
  ChatAgentTurnResult,
} from './agent.types';
import { ChatAgentToolRegistry } from './chat-agent-tool.registry';
import { logAiTurn } from '../utils/log-ai-turn.util';
import type { ResolvedChatIntent } from '../intent/chat-intent.types';
import type { ConversationState } from '../conversation';
import type { ChatRequestDto } from '../presentation/chat-request.dto';
import type { ChatMessageDto } from '../../shared/chat';

const MAX_AGENT_STEPS = 4;

@Injectable()
export class ChatAgentOrchestratorService {
  private readonly logger = new Logger(ChatAgentOrchestratorService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly agentLlm: AgentLlmService,
    private readonly toolRegistry: ChatAgentToolRegistry,
    private readonly activityService: ActivityService,
    private readonly djInfoResolver: DjInfoResolverService,
  ) {}

  getMode(): ChatAgentMode {
    const mode = this.config.get<string>('ai.agent.mode') ?? 'off';
    if (mode === 'shadow' || mode === 'on') {
      return mode;
    }
    return 'off';
  }

  isEnabled(): boolean {
    return this.getMode() !== 'off' && this.agentLlm.enabled;
  }

  shouldRunAgentFirst(
    dto: ChatRequestDto,
    input: string,
    conversationState: ConversationState,
  ): boolean {
    return shouldRunAgentFirst({
      agentEnabled: this.isEnabled(),
      dto,
      input,
      conversationState,
    });
  }

  async runTurn(
    input: ChatAgentTurnInput,
  ): Promise<ChatAgentTurnResult | null> {
    if (!this.isEnabled()) {
      return null;
    }

    const activity =
      input.dto.activityLegacyId != null
        ? await this.activityService.findByLegacyId(input.dto.activityLegacyId)
        : null;

    const llmMessages = buildAgentLlmMessages({
      input: input.input,
      messages: input.messages,
      activity,
      conversationState: input.conversationState,
    });

    const toolsUsed: string[] = [];
    const toolCalls: ChatAgentTurnResult['toolCalls'] = [];

    for (let step = 0; step < MAX_AGENT_STEPS; step += 1) {
      const message = await this.agentLlm.chatWithTools({
        messages: llmMessages,
        tools: this.toolRegistry.openAiToolSchemas(),
      });

      if (!message) {
        return null;
      }

      const assistantToolCalls = message.tool_calls ?? [];
      if (!assistantToolCalls.length) {
        const djFallback = await this.tryDjResolverFallback(input);
        if (djFallback) {
          return djFallback;
        }

        const replyText = message.content?.trim() ?? '';
        if (!replyText) {
          return null;
        }
        return {
          replyText,
          toolsUsed,
          toolCalls,
          steps: step + 1,
        };
      }

      llmMessages.push(message);

      for (const call of assistantToolCalls) {
        const toolName = call.function?.name?.trim() ?? '';
        const args = parseToolCallArgs(call.function?.arguments);
        const tool = this.toolRegistry.get(toolName);

        if (!tool) {
          llmMessages.push({
            role: 'tool',
            tool_call_id: call.id ?? toolName,
            content: JSON.stringify({ ok: false, error: 'tool_not_found' }),
          });
          continue;
        }

        toolsUsed.push(toolName);
        toolCalls.push({ name: toolName, args });

        const result = await tool.execute(input, args);
        llmMessages.push({
          role: 'tool',
          tool_call_id: call.id ?? toolName,
          content: JSON.stringify({
            ok: result.ok,
            content: result.content,
            error: result.error,
          }),
        });
      }
    }

    return null;
  }

  private async tryDjResolverFallback(
    input: ChatAgentTurnInput,
  ): Promise<ChatAgentTurnResult | null> {
    const query = await this.djInfoResolver.resolve({
      messages: input.messages,
      input: input.input,
      activityLegacyId: input.dto.activityLegacyId,
    });
    if (!isActionableDjQuery(query)) {
      return null;
    }

    const tool = this.toolRegistry.get('query_dj_info');
    if (!tool) {
      return null;
    }

    const args: Record<string, unknown> = {
      intent: query.intent,
      artistName: query.artistName,
      referenceArtist: query.referenceArtist,
      styles: query.styles,
      scope: query.scope,
    };
    const result = await tool.execute(input, args);
    if (!result.ok || !result.content?.trim()) {
      return null;
    }

    return {
      replyText: result.content.trim(),
      toolsUsed: ['query_dj_info'],
      toolCalls: [{ name: 'query_dj_info', args }],
      steps: 0,
    };
  }

  scheduleShadowComparison(params: {
    dto: ChatRequestDto;
    messages: ChatMessageDto[];
    input: string;
    conversationState: ConversationState;
    requestId: string;
    sessionId: string;
    legacyIntent: ResolvedChatIntent;
  }): void {
    if (this.getMode() !== 'shadow' || !this.agentLlm.enabled) {
      return;
    }

    void this.runShadowComparison(params).catch((error) => {
      this.logger.warn(
        `agent shadow failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  private async runShadowComparison(params: {
    dto: ChatRequestDto;
    messages: ChatMessageDto[];
    input: string;
    conversationState: ConversationState;
    requestId: string;
    sessionId: string;
    legacyIntent: ResolvedChatIntent;
  }): Promise<void> {
    const startedAt = Date.now();
    const agentResult = await this.runTurn({
      dto: params.dto,
      messages: params.messages,
      input: params.input,
      conversationState: params.conversationState,
      requestId: params.requestId,
      sessionId: params.sessionId,
      legacyIntent: params.legacyIntent,
    });

    const comparison = this.buildShadowComparison({
      input: params.input,
      legacyIntent: params.legacyIntent,
      activityLegacyId: params.dto.activityLegacyId,
      agentResult,
      ms_agent: Date.now() - startedAt,
    });

    logAiTurn(this.logger, {
      event: 'agent_shadow',
      requestId: params.requestId,
      sessionId: params.sessionId,
      intent: params.legacyIntent.kind,
      intentSource: params.legacyIntent.source,
      ...comparison,
    });
  }

  buildShadowComparison(params: {
    input: string;
    legacyIntent: ResolvedChatIntent;
    activityLegacyId?: number;
    agentResult: ChatAgentTurnResult | null;
    ms_agent: number;
  }): ChatAgentShadowComparison {
    const agentToolsUsed = params.agentResult?.toolsUsed ?? [];
    const { expectedTools, intentToolMatch } = compareAgentShadow({
      input: params.input,
      legacyIntent: params.legacyIntent,
      activityLegacyId: params.activityLegacyId,
      agentToolsUsed,
    });

    return {
      legacyIntent: params.legacyIntent.kind,
      legacyIntentSource: params.legacyIntent.source,
      agentToolsUsed,
      expectedTools,
      intentToolMatch,
      agentReplyPreview: (params.agentResult?.replyText ?? '').slice(0, 240),
      ms_agent: params.ms_agent,
    };
  }
}
