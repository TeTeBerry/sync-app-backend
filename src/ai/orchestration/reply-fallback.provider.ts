import { Injectable } from '@nestjs/common';
import type { ConversationState } from '../conversation';
import type { DeterministicReplyResult } from '../handler-pipeline';

@Injectable()
export class ReplyFallbackProvider {
  create(
    state: ConversationState,
    activityLegacyId?: number,
  ): DeterministicReplyResult {
    const activityBound =
      activityLegacyId != null && !Number.isNaN(activityLegacyId);

    const text = activityBound
      ? [
          '我可以帮你查本场资讯、生成出行攻略或组队发帖。',
          '找公开招募请点「找招募帖」，或去活动详情招募区用搜索条筛选。',
          '例如：「这场几点开始」「Marshmello 什么风格」。',
        ].join('\n')
      : [
          '我可以帮你了解电音节阵容、出行攻略与组队发帖。',
          '请点下方电音节快捷按钮绑定活动，或直接说活动名。',
          '绑定后可以说「这场活动几点开始」「Marshmello 什么风格」「生成专属行程」等。',
        ].join('\n');

    return {
      text,
      nextState: state,
    };
  }
}
