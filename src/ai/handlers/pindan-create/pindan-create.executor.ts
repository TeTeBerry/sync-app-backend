import { Injectable } from '@nestjs/common';
import { ActivityService } from '../../../modules/activity/activity.service';
import type { FindBuddyPhase } from '../../conversation';
import { FindBuddyPindanCreateService } from '../../pindan/find-buddy-pindan-create.service';
import { isPindanCreateConfirmMessage, isPindanCreateDeclineMessage } from '../../utils/find-buddy-pindan-intent.util';
import type { ReplyContext, ReplyExecutor } from '../../handler-pipeline/handler-pipeline.types';

const BROWSE_PINDAN_PHASE: FindBuddyPhase = 'browse_pindan';

@Injectable()
export class PindanCreateExecutor implements ReplyExecutor {
  constructor(
    private readonly findBuddyPindanCreateService: FindBuddyPindanCreateService,
    private readonly activityService: ActivityService,
  ) {}

  async execute(ctx: ReplyContext) {
    const fb = ctx.state.findBuddy;
    if (!fb) return null;

    if (isPindanCreateDeclineMessage(ctx.input)) {
      const activityName =
        fb.activityKeyword ??
        (fb.activityId
          ? (await this.activityService.findByCode(fb.activityId))?.name
          : undefined) ??
        fb.activityId ??
        '该活动';

      return {
        text: this.findBuddyPindanCreateService.buildDeclineReply(activityName),
        nextState: {
          ...ctx.state,
          findBuddy: {
            ...fb,
            phase: BROWSE_PINDAN_PHASE,
          },
        },
      };
    }

    if (isPindanCreateConfirmMessage(ctx.input)) {
      const matched = fb.activityId
        ? await this.activityService.findByCode(fb.activityId)
        : fb.activityKeyword
          ? await this.activityService.matchActivity(fb.activityKeyword)
          : null;

      return this.findBuddyPindanCreateService.createFromFindBuddy({
        state: ctx.state,
        userId: ctx.userId,
        matchedActivity: matched,
      });
    }

    return {
      text: this.findBuddyPindanCreateService.buildCreatePrompt(
        fb,
        fb.activityKeyword,
      ),
      nextState: ctx.state,
    };
  }
}
