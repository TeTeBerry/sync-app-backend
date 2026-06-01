import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../../shared/chat';
import {
  applyFlowSwitch,
  createIdleState,
  type ConversationState,
} from '../conversation';

/**
 * 会话状态机门面
 */
@Injectable()
export class ConversationStateService {
  resolve(
    stored: ConversationState | null | undefined,
    _messages?: ChatMessageDto[],
  ): ConversationState {
    if (stored?.flow) {
      return stored;
    }
    return createIdleState();
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
