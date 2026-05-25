import { Injectable } from '@nestjs/common';
import { applyFlowSwitch } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { PindanService } from '../../modules/pindan/pindan.service';
import { ProfileService } from '../../modules/profile/profile.service';
import { buildQuickReplyResponse } from '../utils/quick-reply.handler';
import { isQuickReplyIntent, detectUserIntent } from '../utils/user-intent';
import { composeReply } from '../utils/reply-text.util';
import { isFindBuddyFlow, isTicketListingFlow } from '../conversation';
import { isFindBuddyRestartRequest } from '../utils/find-buddy-correction.util';
import type {
  DeterministicReplyResult,
  ReplyContext,
  ReplyHandler,
} from './reply-handler.types';

@Injectable()
export class QuickReplyHandler implements ReplyHandler {
  constructor(
    private readonly activityService: ActivityService,
    private readonly pindanService: PindanService,
    private readonly profileService: ProfileService,
  ) {}

  canHandle(ctx: ReplyContext): boolean {
    if (ctx.image?.trim()) return false;
    if (!isQuickReplyIntent(ctx.input)) return false;

    const intent = detectUserIntent(ctx.input);
    if (
      isFindBuddyFlow(ctx.state) &&
      intent === 'find_buddy' &&
      !isFindBuddyRestartRequest(ctx.input)
    ) {
      return false;
    }
    if (
      isTicketListingFlow(ctx.state) &&
      ctx.state.ticketListing &&
      ((intent === 'sell_ticket' &&
        ctx.state.ticketListing.listingType === 'sell') ||
        (intent === 'buy_ticket' &&
          ctx.state.ticketListing.listingType === 'buy'))
    ) {
      return false;
    }

    return true;
  }

  async handle(ctx: ReplyContext): Promise<DeterministicReplyResult | null> {
    const text = await buildQuickReplyResponse(
      ctx.input,
      {
        pindanService: this.pindanService,
        activityService: this.activityService,
        profileService: this.profileService,
      },
      ctx,
    );
    if (!text) return null;

    const nextState =
      applyFlowSwitch(ctx.state, ctx.input) ?? ctx.state;
    return { text, nextState };
  }
}
