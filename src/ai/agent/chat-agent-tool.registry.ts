import { Injectable } from '@nestjs/common';
import { GetActivityBriefTool } from './tools/get-activity-brief.tool';
import { QueryDjInfoTool } from './tools/query-dj-info.tool';
import { PostConfirmPublishTool } from './tools/post-confirm-publish.tool';
import { PostStartCollectTool } from './tools/post-start-collect.tool';
import { PostSubmitTool } from './tools/post-submit.tool';
import { TravelGuideCollectSlotsTool } from './tools/travel-guide-collect-slots.tool';
import { TravelGuideGenerateTool } from './tools/travel-guide-generate.tool';
import {
  ItineraryCollectAndGenerateTool,
  ItineraryGenerateTool,
} from './tools/itinerary.tools';
import type { ChatAgentTool } from './tools/chat-agent-tool.types';

@Injectable()
export class ChatAgentToolRegistry {
  private readonly tools: ChatAgentTool[];

  constructor(
    queryDjInfoTool: QueryDjInfoTool,
    getActivityBriefTool: GetActivityBriefTool,
    postStartCollectTool: PostStartCollectTool,
    postSubmitTool: PostSubmitTool,
    postConfirmPublishTool: PostConfirmPublishTool,
    travelGuideCollectSlotsTool: TravelGuideCollectSlotsTool,
    travelGuideGenerateTool: TravelGuideGenerateTool,
    itineraryCollectAndGenerateTool: ItineraryCollectAndGenerateTool,
    itineraryGenerateTool: ItineraryGenerateTool,
  ) {
    this.tools = [
      queryDjInfoTool,
      getActivityBriefTool,
      postStartCollectTool,
      postSubmitTool,
      postConfirmPublishTool,
      travelGuideCollectSlotsTool,
      travelGuideGenerateTool,
      itineraryCollectAndGenerateTool,
      itineraryGenerateTool,
    ];
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
