import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  applyFlowSwitch,
  bootstrapConversationState,
  type ConversationState,
} from '../conversation';
import { TicketListingStateAdvancer } from './ticket-listing-state.advancer';
import { FindBuddyStateAdvancer } from './find-buddy-state.advancer';
import { ImageDisambiguationService } from './image-disambiguation.service';

/**
 * 会话状态机门面：协调各子流程的状态推进
 */
@Injectable()
export class ConversationStateService {
  constructor(
    private readonly ticketListingAdvancer: TicketListingStateAdvancer,
    private readonly findBuddyAdvancer: FindBuddyStateAdvancer,
    private readonly imageDisambiguation: ImageDisambiguationService,
  ) {}

  resolve(
    stored: ConversationState | null | undefined,
    messages: ChatMessageDto[],
  ): ConversationState {
    if (stored?.flow && stored.flow !== 'idle') {
      return stored;
    }
    if (messages.length) {
      return bootstrapConversationState(messages);
    }
    return stored ?? bootstrapConversationState([]);
  }

  async advance(
    state: ConversationState,
    messages: ChatMessageDto[],
    input: string,
    userPhone?: string,
    image?: string,
  ): Promise<ConversationState> {
    const switched = applyFlowSwitch(state, input);
    const next = switched ?? state;

    if (next.flow === 'ticket_listing') {
      if (switched && !image?.trim()) return next;
      return this.ticketListingAdvancer.advance(next, input, userPhone, image);
    }

    if (next.flow === 'find_buddy') {
      if (switched && !image?.trim()) return next;
      return this.findBuddyAdvancer.advance(next, messages, input, image);
    }

    if (next.flow === 'idle' && image?.trim()) {
      const result = await this.imageDisambiguation.disambiguate(
        next,
        messages,
        input,
        userPhone,
        image,
      );
      return result.state;
    }

    return next;
  }
}
