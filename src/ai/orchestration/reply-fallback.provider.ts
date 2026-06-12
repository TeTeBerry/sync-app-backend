import { Injectable } from '@nestjs/common';
import type { ConversationState } from '../conversation';
import type { DeterministicReplyResult } from '../handler-pipeline';

@Injectable()
export class ReplyFallbackProvider {
  create(state: ConversationState): DeterministicReplyResult {
    return {
      text: [
        '我可以帮你了解电音节阵容、出行攻略或发帖。',
        '请点下方电音节快捷按钮，或直接说活动名和需求。',
      ].join('\n'),
      nextState: state,
    };
  }
}
