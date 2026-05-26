import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import type { ConversationState } from '../conversation';
import { ConversationStateService } from './conversation-state.service';
import { AgentRuntimeService } from './legacy/agent-runtime.service';
import {
  type DeterministicReplyResult,
  type ReplyContext,
} from '../handler-pipeline';

export interface DeterministicReplyContext {
  userId?: string;
  userName?: string;
  userPhone?: string;
  image?: string;
  activityLegacyId?: number;
}

@Injectable()
export class DeterministicReplyService {
  constructor(
    private readonly conversationStateService: ConversationStateService,
    private readonly agentRuntime: AgentRuntimeService,
  ) {}

  resolveConversationState(
    stored: ConversationState | null | undefined,
    messages: ChatMessageDto[],
  ): ConversationState {
    return this.conversationStateService.resolve(stored, messages);
  }

  /** Agentic 状态机回复：规则 Handler + 模板，LLM 仅参与槽位解析 */
  async resolve(
    messages: ChatMessageDto[],
    input: string,
    context: DeterministicReplyContext,
    conversationState: ConversationState,
  ): Promise<DeterministicReplyResult> {
    const state = await this.conversationStateService.advance(
      conversationState,
      messages,
      input,
      context.userPhone,
      context.image,
    );

    const replyContext: ReplyContext = {
      messages,
      input,
      state,
      userId: context.userId,
      userName: context.userName,
      userPhone: context.userPhone,
      image: context.image,
      activityLegacyId: context.activityLegacyId,
    };

    const runtimeResult = await this.agentRuntime.run(replyContext);
    return runtimeResult.result;
  }
}
