import { Injectable } from '@nestjs/common';
import type { ConversationState } from '../conversation';
import type { DeterministicReplyResult } from '../handler-pipeline';

@Injectable()
export class ReplyFallbackProvider {
  create(state: ConversationState): DeterministicReplyResult {
    return {
      text: [
        '我可以帮你查最近活动，或了解某个电音节的信息。',
        '请点下方快捷按钮，或直接说需求（如「查最近活动」「帮我组队」）。',
      ].join('\n'),
      nextState: state,
    };
  }
}
