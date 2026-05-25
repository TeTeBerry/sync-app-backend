import { Injectable } from '@nestjs/common';
import { isQuickReplyIntent, detectUserIntent } from '../../utils/user-intent';
import { isFindBuddyFlow, isTicketListingFlow } from '../../conversation';
import { isFindBuddyRestartRequest } from '../../utils/find-buddy-correction.util';
import type { ReplyContext, ReplyMatcher } from '../../handler-pipeline/handler-pipeline.types';

@Injectable()
export class QuickReplyMatcher implements ReplyMatcher {
  matches(ctx: ReplyContext): boolean {
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
}
