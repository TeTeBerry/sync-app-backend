import { Injectable } from '@nestjs/common';
import { ActivityRegistrationAgentToolService } from '../activity-registration-agent-tool.service';
import type { ChatAgentTurnInput } from '../agent.types';
import type {
  ChatAgentTool,
  ChatAgentToolExecutionResult,
} from './chat-agent-tool.types';

@Injectable()
export class ActivityRegisterTool implements ChatAgentTool {
  readonly definition = {
    name: 'activity_register',
    description:
      '帮当前用户报名活动。默认使用已绑定活动，也可在参数中指定 activityLegacyId。',
    parameters: {
      type: 'object',
      properties: {
        activityLegacyId: { type: 'number' },
      },
    },
  };

  constructor(
    private readonly registrationTools: ActivityRegistrationAgentToolService,
  ) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const activityLegacyId =
      typeof args.activityLegacyId === 'number'
        ? args.activityLegacyId
        : undefined;
    return this.registrationTools.register(
      input,
      input.runtime,
      activityLegacyId,
    );
  }
}

@Injectable()
export class ActivityUnregisterTool implements ChatAgentTool {
  readonly definition = {
    name: 'activity_unregister',
    description: '取消当前用户对活动的报名。',
    parameters: {
      type: 'object',
      properties: {
        activityLegacyId: { type: 'number' },
      },
    },
  };

  constructor(
    private readonly registrationTools: ActivityRegistrationAgentToolService,
  ) {}

  execute(
    input: ChatAgentTurnInput,
    args: Record<string, unknown>,
  ): Promise<ChatAgentToolExecutionResult> {
    const activityLegacyId =
      typeof args.activityLegacyId === 'number'
        ? args.activityLegacyId
        : undefined;
    return this.registrationTools.unregister(
      input,
      input.runtime,
      activityLegacyId,
    );
  }
}
