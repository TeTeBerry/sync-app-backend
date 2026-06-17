import { Injectable } from '@nestjs/common';
import type { ConversationState } from '../conversation';
import type { DeterministicReplyResult } from '../handler-pipeline';

@Injectable()
export class ReplyFallbackProvider {
  create(state: ConversationState): DeterministicReplyResult {
    return {
      text: [
        '我可以帮你了解电音节阵容、出行攻略与组队发帖。',
        '请点下方电音节快捷按钮绑定活动，或直接说活动名。',
        '绑定后可以说「这场活动几点开始」「Marshmello 什么风格」「生成专属行程」等。',
      ].join('\n'),
      nextState: state,
    };
  }
}
