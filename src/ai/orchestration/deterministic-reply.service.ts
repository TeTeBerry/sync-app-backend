import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../dto/chat.dto';
import type { ConversationState } from '../conversation';
import { ConversationStateService } from './conversation-state.service';
import { QuickReplyHandler } from '../handlers/quick-reply.handler';
import { PindanJoinHandler } from '../handlers/pindan-join.handler';
import { TicketListingHandler } from '../handlers/ticket-listing.handler';
import { StructuredReplyHandler } from '../handlers/structured-reply.handler';
import { TicketSearchHandler } from '../handlers/ticket-search.handler';
import {
  type DeterministicReplyResult,
  type ReplyContext,
  type ReplyHandler,
} from '../handlers/reply-handler.types';

export interface DeterministicReplyContext {
  userId?: string;
  userName?: string;
  onTicketCreated?: (ticketId: string) => void;
}

@Injectable()
export class DeterministicReplyService {
  private readonly handlers: ReplyHandler[];

  constructor(
    private readonly conversationStateService: ConversationStateService,
    quickReplyHandler: QuickReplyHandler,
    pindanJoinHandler: PindanJoinHandler,
    ticketListingHandler: TicketListingHandler,
    structuredReplyHandler: StructuredReplyHandler,
    ticketSearchHandler: TicketSearchHandler,
  ) {
    this.handlers = [
      quickReplyHandler,
      pindanJoinHandler,
      ticketListingHandler,
      structuredReplyHandler,
      ticketSearchHandler,
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
    );

    const replyContext: ReplyContext = {
      messages,
      input,
      state,
      userId: context.userId,
      userName: context.userName,
      onTicketCreated: context.onTicketCreated,
    };

    for (const handler of this.handlers) {
      if (!(await handler.canHandle(replyContext))) {
        continue;
      }
      const result = await handler.handle(replyContext);
      if (result) {
        return result;
      }
    }

    return {
      text: [
        '我可以帮你：找同行搭子、发布出票/收票、查活动或查门票挂单。',
        '请点下方快捷按钮，或直接说需求（如「查 EDC 票」「我有票要出」）。',
      ].join('\n'),
      nextState: state,
    };
  }
}
