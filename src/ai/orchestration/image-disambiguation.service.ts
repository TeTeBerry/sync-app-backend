import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../presentation/chat-message.dto';
import type { ConversationState } from '../conversation';
import { TicketImageParserService } from '../parser/ticket-image-parser.service';
import { FindBuddyImageParserService } from '../parser/find-buddy-image-parser.service';
import { sanitizeLlmTicketPatch } from '../parser/slot-merge.util';
import {
  inferListingTypeFromHint,
  isAmbiguousImageInference,
  scoreFindBuddyVision,
  scoreTicketVision,
} from '../utils/image-flow-inference.util';
import type { TicketDraft } from '../utils/ticket-draft.parser';
import { TicketListingStateAdvancer } from './ticket-listing-state.advancer';
import { FindBuddyStateAdvancer } from './find-buddy-state.advancer';

export type ImageDisambiguationResult =
  | { type: 'ambiguous'; state: ConversationState }
  | { type: 'ticket'; state: ConversationState }
  | { type: 'find_buddy'; state: ConversationState }
  | { type: 'none'; state: ConversationState };

/**
 * 专门负责图片意图识别和路由
 */
@Injectable()
export class ImageDisambiguationService {
  constructor(
    private readonly ticketImageParser: TicketImageParserService,
    private readonly findBuddyImageParser: FindBuddyImageParserService,
    private readonly ticketListingAdvancer: TicketListingStateAdvancer,
    private readonly findBuddyAdvancer: FindBuddyStateAdvancer,
  ) {}

  async disambiguate(
    state: ConversationState,
    messages: ChatMessageDto[],
    input: string,
    userPhone?: string,
    image?: string,
  ): Promise<ImageDisambiguationResult> {
    if (!image?.trim()) return { type: 'none', state };

    const listingType = inferListingTypeFromHint(input);
    const [ticketVision, findBuddyVision] = await Promise.all([
      this.ticketImageParser.parseTicketImage(image, listingType, input),
      this.findBuddyImageParser.parseFindBuddyImage(image, input),
    ]);

    const ticketScore = scoreTicketVision(ticketVision);
    const buddyScore = scoreFindBuddyVision(findBuddyVision);

    if (isAmbiguousImageInference(ticketScore, buddyScore)) {
      return {
        type: 'ambiguous',
        state: { ...state, pendingImageDisambiguation: true },
      };
    }

    if (ticketScore >= 2 && ticketScore > buddyScore) {
      const visionPatch = sanitizeLlmTicketPatch(ticketVision);
      const newState = await this.ticketListingAdvancer.advanceFromImage(
        listingType,
        visionPatch,
        input,
        userPhone,
        image,
      );
      return { type: 'ticket', state: newState };
    }

    if (buddyScore >= 2 && buddyScore > ticketScore) {
      const newState = await this.findBuddyAdvancer.advanceFromImage(
        messages,
        input,
        image,
      );
      return { type: 'find_buddy', state: newState };
    }

    if (ticketScore >= 2) {
      const visionPatch = sanitizeLlmTicketPatch(ticketVision);
      const newState = await this.ticketListingAdvancer.advanceFromImage(
        listingType,
        visionPatch,
        input,
        userPhone,
        image,
      );
      return { type: 'ticket', state: newState };
    }

    if (buddyScore >= 2) {
      const newState = await this.findBuddyAdvancer.advanceFromImage(
        messages,
        input,
        image,
      );
      return { type: 'find_buddy', state: newState };
    }

    return { type: 'none', state };
  }
}
