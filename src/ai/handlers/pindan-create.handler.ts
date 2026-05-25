import { Injectable } from '@nestjs/common';
import { isFindBuddyFlow } from '../conversation';
import { FindBuddyPindanCreateService } from '../pindan/find-buddy-pindan-create.service';
import { ActivityService } from '../../modules/activity/activity.service';
import {
  isPindanCreateConfirmMessage,
  isPindanCreateDeclineMessage,
} from '../utils/find-buddy-pindan-intent.util';
import type {
  AgentStateProgression,
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class PindanCreateHandler implements ReplyHandler {
  getPlannedToolCalls(ctx: ReplyContext) {
    const fb = ctx.state.findBuddy;
    if (!fb) return [];
    if (fb.phase === 'confirm_create_pindan') {
      return [{ tool: 'findBuddy.createPindan', args: { phase: fb.phase } }];
    }
    return [{ tool: 'findBuddy.collectCreateSlots', args: { phase: fb.phase } }];
  }

  getStateProgression(ctx: ReplyContext): AgentStateProgression {
    return {
      flow: 'find_buddy',
      phase: ctx.state.findBuddy?.phase,
      summary: '搭子拼单创建确认与提交',
    };
  }

  constructor(
    private readonly findBuddyPindanCreateService: FindBuddyPindanCreateService,
    private readonly activityService: ActivityService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    const fb = ctx.state.findBuddy;
    if (!isFindBuddyFlow(ctx.state) || !fb) return false;
    return fb.phase === 'confirm_create_pindan';
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
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
            phase: 'browse_pindan',
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

      const result = await this.findBuddyPindanCreateService.createFromFindBuddy({
        state: ctx.state,
        userId: ctx.userId,
        matchedActivity: matched,
      });

      return {
        text: result.text,
        pindanCard: result.pindanCard,
        nextState: result.nextState,
      };
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
