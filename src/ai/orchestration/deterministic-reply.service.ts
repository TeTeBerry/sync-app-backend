import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../dto/chat.dto';
import type { ConversationState } from '../conversation';
import { ConversationStateService } from './conversation-state.service';
import { AgentRuntimeService } from './agent-runtime.service';
import {
  FindBuddyCollectHandler,
  PackagePickHandler,
  PindanCreateHandler,
  PindanJoinHandler,
  QuickReplyHandler,
  StructuredReplyHandler,
  TicketListingHandler,
  TicketSearchHandler,
  TicketSelectHandler,
} from '../handlers';
import {
  type DeterministicReplyResult,
  type ReplyContext,
  type ReplyHandler,
} from '../handlers/reply-handler.types';

export interface DeterministicReplyContext {
  userId?: string;
  userName?: string;
  userPhone?: string;
  image?: string;
  onTicketCreated?: (ticketId: string) => void;
}

@Injectable()
export class DeterministicReplyService {
  private readonly handlers: ReplyHandler[];

  constructor(
    private readonly conversationStateService: ConversationStateService,
    private readonly agentRuntime: AgentRuntimeService,
    quickReplyHandler: QuickReplyHandler,
    pindanJoinHandler: PindanJoinHandler,
    findBuddyCollectHandler: FindBuddyCollectHandler,
    packagePickHandler: PackagePickHandler,
    pindanCreateHandler: PindanCreateHandler,
    ticketListingHandler: TicketListingHandler,
    structuredReplyHandler: StructuredReplyHandler,
    ticketSearchHandler: TicketSearchHandler,
    ticketSelectHandler: TicketSelectHandler,
  ) {
    this.handlers = [
      quickReplyHandler,
      pindanJoinHandler,
      findBuddyCollectHandler,
      packagePickHandler,
      pindanCreateHandler,
      ticketListingHandler,
      structuredReplyHandler,
      ticketSearchHandler,
      ticketSelectHandler,
    ];
  }

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

    if (state.pendingImageDisambiguation) {
      return {
        text: [
          '看起来像是门票截图或套餐/出行订单 📷',
          '',
          '你想「出票/收票」还是「找搭子拼单」？直接告诉我即可。',
        ].join('\n'),
        nextState: { ...state, pendingImageDisambiguation: undefined },
      };
    }

    const replyContext: ReplyContext = {
      messages,
      input,
      state,
      userId: context.userId,
      userName: context.userName,
      userPhone: context.userPhone,
      image: context.image,
      onTicketCreated: context.onTicketCreated,
    };

    const runtimeResult = await this.agentRuntime.run(replyContext, this.handlers);
    return runtimeResult.result;
  }
}
