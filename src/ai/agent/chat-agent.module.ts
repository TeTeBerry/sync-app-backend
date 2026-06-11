import { Module } from '@nestjs/common';
import { ActivityModule } from '../../modules/activity/activity.module';
import { DjInfoModule } from '../dj/dj-info.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { AgentLlmService } from './agent-llm.service';
import { ChatAgentOrchestratorService } from './chat-agent-orchestrator.service';
import { ChatAgentToolRegistry } from './chat-agent-tool.registry';
import { GetActivityBriefTool } from './tools/get-activity-brief.tool';
import { GetFestivalInfoTool } from './tools/get-festival-info.tool';
import { QueryDjInfoTool } from './tools/query-dj-info.tool';

@Module({
  imports: [ActivityModule, DjInfoModule, InfraLlmModule],
  providers: [
    AgentLlmService,
    ChatAgentToolRegistry,
    QueryDjInfoTool,
    GetFestivalInfoTool,
    GetActivityBriefTool,
    ChatAgentOrchestratorService,
  ],
  exports: [ChatAgentOrchestratorService],
})
export class ChatAgentModule {}
