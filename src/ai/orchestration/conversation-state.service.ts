import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import {
  applyFlowSwitch,
  bootstrapConversationState,
  type ConversationState,
} from '../conversation';

/**
 * 会话状态机门面
 */
@Injectable()
export class ConversationStateService {
  resolve(
    stored: ConversationState | null | undefined,
    messages: ChatMessageDto[],
  ): ConversationState {
    if (stored?.flow) {
      return stored;
    }
    if (messages.length) {
      return bootstrapConversationState(messages);
    }
    return stored ?? bootstrapConversationState([]);
  }

  async advance(
    state: ConversationState,
    _messages: ChatMessageDto[],
    input: string,
    _userPhone?: string,
    _image?: string,
  ): Promise<ConversationState> {
    return applyFlowSwitch(state, input) ?? state;
  }
}
