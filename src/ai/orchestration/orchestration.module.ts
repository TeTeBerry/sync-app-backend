import { Module } from '@nestjs/common';
import { ConversationStateService } from './conversation-state.service';
import { DeterministicReplyService } from './deterministic-reply.service';
import { AgentRuntimeService } from './agent-runtime.service';
import { AgentToolsService, AGENT_TOOL_TOKEN } from './agent-tools.service';
import { ReplyFallbackProvider } from './reply-fallback.provider';
import { RagModule } from '../rag/rag.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { ActivityModule } from '../../modules/activity/activity.module';
import { HandlerModule } from '../handlers/handler.module';

@Module({
  imports: [RagModule, InfraLlmModule, ActivityModule, HandlerModule],
  providers: [
    ConversationStateService,
    DeterministicReplyService,
    AgentRuntimeService,
    AgentToolsService,
    ReplyFallbackProvider,
    {
      provide: AGENT_TOOL_TOKEN,
      useFactory: () => [],
    },
  ],
  exports: [
    ConversationStateService,
    AgentRuntimeService,
    AgentToolsService,
    DeterministicReplyService,
  ],
})
export class OrchestrationModule {}
