import { Injectable } from '@nestjs/common';
import { isActivityBriefIntent } from '../../utils/activity-brief-intent.util';
import { isQuickReplyIntent } from '../../intent/user-intent';
import type {
  ReplyContext,
  ReplyMatcher,
} from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class QuickReplyMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
    if (ctx.image?.trim()) return false;
    if (
      ctx.activityLegacyId != null &&
      isActivityBriefIntent(ctx.input.trim())
    ) {
      return true;
    }
    return isQuickReplyIntent(ctx.input);
  }
}
