import { Injectable } from '@nestjs/common';
import { ProfileAgentToolService } from '../profile-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class ProfileGetSummaryTool implements ChatAgentTool {
  readonly definition = {
    name: 'profile_get_summary',
    description:
      '获取当前用户的个人资料摘要（昵称、地区、已选活动数、组队帖数）。',
    parameters: { type: 'object', properties: {} },
  };

  constructor(private readonly profileTools: ProfileAgentToolService) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.profileTools.getSummary(input);
  }
}

@Injectable()
export class ProfileListRegistrationsTool implements ChatAgentTool {
  readonly definition = {
    name: 'profile_list_registrations',
    description: '列出当前用户已选择的活动。',
    parameters: { type: 'object', properties: {} },
  };

  constructor(private readonly profileTools: ProfileAgentToolService) {}

  execute(input: ChatAgentTurnInput): Promise<ChatAgentToolExecutionResult> {
    return this.profileTools.listRegistrations(input);
  }
}
