import { Injectable } from '@nestjs/common';
import type { ConversationState } from '../conversation';
import type { DeterministicReplyResult } from '../handler-pipeline';

@Injectable()
export class ReplyFallbackProvider {
  create(state: ConversationState): DeterministicReplyResult {
    return {
      text: [
        '我可以帮你：找同行搭子、发布出票/收票、查活动或查门票挂单。',
        '请点下方快捷按钮，或直接说需求（如「查 EDC 票」「我有票要出」）。',
      ].join('\n'),
      nextState: state,
    };
  }
}
