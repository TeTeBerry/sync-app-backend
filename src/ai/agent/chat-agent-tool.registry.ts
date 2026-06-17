import { Injectable } from '@nestjs/common';
import { GetActivityBriefTool } from './tools/get-activity-brief.tool';
import { GetFestivalInfoTool } from './tools/get-festival-info.tool';
import { QueryDjInfoTool } from './tools/query-dj-info.tool';
import { PostConfirmPublishTool } from './tools/post-confirm-publish.tool';
import { PostStartCollectTool } from './tools/post-start-collect.tool';
import { PostSubmitTool } from './tools/post-submit.tool';
import { TravelGuideCollectSlotsTool } from './tools/travel-guide-collect-slots.tool';
import { TravelGuideGenerateTool } from './tools/travel-guide-generate.tool';
import {
  ActivityRegisterTool,
  ActivityUnregisterTool,
} from './tools/activity-registration.tools';
import {
  ItineraryCollectAndGenerateTool,
  ItineraryGenerateTool,
  ItineraryGetScheduleTool,
  ItineraryOpenSheetTool,
} from './tools/itinerary.tools';
import {
  PersonalityTestGetResultTool,
  PersonalityTestOpenTool,
} from './tools/personality-test.tools';
import {
  PostAddCommentTool,
  PostListCommentsTool,
} from './tools/post-comment.tools';
import {
  ProfileGetSummaryTool,
  ProfileListRegistrationsTool,
} from './tools/profile.tools';
import type { ChatAgentTool } from './tools/chat-agent-tool.types';

@Injectable()
export class ChatAgentToolRegistry {
  private readonly tools: ChatAgentTool[];

  constructor(
    queryDjInfoTool: QueryDjInfoTool,
    getFestivalInfoTool: GetFestivalInfoTool,
    getActivityBriefTool: GetActivityBriefTool,
    postStartCollectTool: PostStartCollectTool,
    postSubmitTool: PostSubmitTool,
    postConfirmPublishTool: PostConfirmPublishTool,
    travelGuideCollectSlotsTool: TravelGuideCollectSlotsTool,
    travelGuideGenerateTool: TravelGuideGenerateTool,
    profileGetSummaryTool: ProfileGetSummaryTool,
    profileListRegistrationsTool: ProfileListRegistrationsTool,
    activityRegisterTool: ActivityRegisterTool,
    activityUnregisterTool: ActivityUnregisterTool,
    personalityTestGetResultTool: PersonalityTestGetResultTool,
    personalityTestOpenTool: PersonalityTestOpenTool,
    itineraryGetScheduleTool: ItineraryGetScheduleTool,
    itineraryOpenSheetTool: ItineraryOpenSheetTool,
    itineraryCollectAndGenerateTool: ItineraryCollectAndGenerateTool,
    itineraryGenerateTool: ItineraryGenerateTool,
    postListCommentsTool: PostListCommentsTool,
    postAddCommentTool: PostAddCommentTool,
  ) {
    this.tools = [
      queryDjInfoTool,
      getFestivalInfoTool,
      getActivityBriefTool,
      postStartCollectTool,
      postSubmitTool,
      postConfirmPublishTool,
      travelGuideCollectSlotsTool,
      travelGuideGenerateTool,
      profileGetSummaryTool,
      profileListRegistrationsTool,
      activityRegisterTool,
      activityUnregisterTool,
      personalityTestGetResultTool,
      personalityTestOpenTool,
      itineraryGetScheduleTool,
      itineraryOpenSheetTool,
      itineraryCollectAndGenerateTool,
      itineraryGenerateTool,
      postListCommentsTool,
      postAddCommentTool,
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
