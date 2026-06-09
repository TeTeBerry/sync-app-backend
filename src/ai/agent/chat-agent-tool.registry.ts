import { Injectable } from '@nestjs/common';
import { GetActivityBriefTool } from './tools/get-activity-brief.tool';
import { GetFestivalInfoTool } from './tools/get-festival-info.tool';
import { QueryDjInfoTool } from './tools/query-dj-info.tool';
import type { ChatAgentTool } from './tools/chat-agent-tool.types';

@Injectable()
export class ChatAgentToolRegistry {
  private readonly tools: ChatAgentTool[];

  constructor(
    queryDjInfoTool: QueryDjInfoTool,
    getFestivalInfoTool: GetFestivalInfoTool,
    getActivityBriefTool: GetActivityBriefTool,
  ) {
    this.tools = [queryDjInfoTool, getFestivalInfoTool, getActivityBriefTool];
  }

  all(): ChatAgentTool[] {
    return this.tools;
  }

  get(name: string): ChatAgentTool | undefined {
    return this.tools.find((tool) => tool.definition.name === name);
  }

  openAiToolSchemas(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }> {
    return this.tools.map((tool) => ({
      type: 'function',
      function: {
        name: tool.definition.name,
        description: tool.definition.description,
        parameters: tool.definition.parameters,
      },
    }));
  }
}
