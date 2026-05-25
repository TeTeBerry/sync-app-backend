import { Injectable } from '@nestjs/common';
import type { DeterministicReplyResult, ReplyComposer, ReplyContext } from '../../handler-pipeline/handler-pipeline.types';
import type { PindanJoinReplyResult } from '../../utils/pindan-join.handler';

@Injectable()
export class PindanJoinComposer implements ReplyComposer {
  compose(ctx: ReplyContext, result: PindanJoinReplyResult): DeterministicReplyResult {
    return {
      text: result.text,
      pindanCard: result.pindanCard,
      nextState: result.nextState ?? ctx.state,
    };
  }
}
