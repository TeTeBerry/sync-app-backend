import { Injectable } from '@nestjs/common';
import { isFindBuddyFlow } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import {
  getMissingActivityCreateFields,
  mergeActivityCreateSlots,
} from '../utils/find-buddy-activity-create.util';
import {
  buildFindBuddyCollectCreateReply,
  buildFindBuddyCreatePindanPrompt,
} from '../utils/find-buddy-reply.util';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class FindBuddyCollectHandler implements ReplyHandler {
  constructor(private readonly activityService: ActivityService) {}

  canHandle(ctx: ReplyContext): boolean {
    const fb = ctx.state.findBuddy;
    return Boolean(isFindBuddyFlow(ctx.state) && fb?.phase === 'collect_create_pindan');
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const fb = ctx.state.findBuddy!;
    const merged = mergeActivityCreateSlots(fb, ctx.input);
    const activityName =
      merged.activityKeyword ??
      (merged.activityId
        ? (await this.activityService.findByCode(merged.activityId))?.name
        : undefined) ??
      merged.activityId;

    const missing = getMissingActivityCreateFields(merged);

    if (missing.length > 0) {
      return {
        text: buildFindBuddyCollectCreateReply(merged, activityName),
        nextState: {
          ...ctx.state,
          findBuddy: {
            ...merged,
            phase: 'collect_create_pindan',
          },
        },
      };
    }

    return {
      text: buildFindBuddyCreatePindanPrompt(merged, activityName),
      nextState: {
        ...ctx.state,
        findBuddy: {
          ...merged,
          phase: 'confirm_create_pindan',
        },
      },
    };
  }
}
