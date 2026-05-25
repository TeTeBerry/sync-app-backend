import { Injectable } from '@nestjs/common';
import type { DeterministicReplyResult, ReplyComposer, ReplyContext } from '../../handler-pipeline/handler-pipeline.types';
import type { StructuredReplyResult } from '../../utils/structured-reply.handler';

@Injectable()
export class StructuredReplyComposer implements ReplyComposer {
  compose(_ctx: ReplyContext, result: StructuredReplyResult): DeterministicReplyResult {
    return {
      text: result.text,
      pindanCard: result.pindanCard,
      nextState: result.nextState,
    };
  }
}
