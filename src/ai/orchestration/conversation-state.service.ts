import { Injectable } from '@nestjs/common';
import { ChatMessageDto } from '../dto/chat.dto';
import {
  applyFindBuddyInput,
  applyFlowSwitch,
  applyTicketListingInput,
  bootstrapConversationState,
  mergeFindBuddyFacts,
  type ConversationState,
} from '../conversation';
import {
  absorbUserTicketMessage,
  isTicketConfirmMessage,
  isTicketDraftComplete,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import { ActivityService } from '../../modules/activity/activity.service';
import { detectCorrectionFields } from '../parser/correction-intent.util';
import { LlmSlotParserService } from '../parser/llm-slot-parser.service';
import {
  buildLlmFieldMeta,
  buildRuleFieldMeta,
  diffTicketDraft,
} from '../parser/rule-slot-meta.util';
import {
  mergeFindBuddyFromLlm,
  mergeTicketSlots,
  sanitizeLlmTicketPatch,
} from '../parser/slot-merge.util';

/**
 * Agentic 状态机：规则 + LLM 槽位解析 → 带来源/置信度的结构化存储
 */
@Injectable()
export class ConversationStateService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly llmSlotParser: LlmSlotParserService,
  ) {}

  resolve(
    stored: ConversationState | null | undefined,
    messages: ChatMessageDto[],
  ): ConversationState {
    if (stored?.flow && stored.flow !== 'idle') {
      return stored;
    }
    if (messages.length) {
      return bootstrapConversationState(messages);
    }
    return stored ?? bootstrapConversationState([]);
  }

  async advance(
    state: ConversationState,
    messages: ChatMessageDto[],
    input: string,
  ): Promise<ConversationState> {
    const switched = applyFlowSwitch(state, input);
    let next = switched ?? state;

    if (next.flow === 'ticket_listing') {
      if (switched) return next;
      return this.advanceTicketListing(next, input);
    }

    if (next.flow === 'find_buddy') {
      if (switched) return next;
      return this.advanceFindBuddy(next, messages, input);
    }

    return next;
  }

  private async advanceTicketListing(
    state: ConversationState,
    input: string,
  ): Promise<ConversationState> {
    if (isTicketConfirmMessage(input)) {
      return applyTicketListingInput(state, input);
    }

    const listing = state.ticketListing!;
    const baseDraft: TicketDraft = {
      ...listing.draft,
      type: listing.listingType,
    };
    const baseMeta = listing.draftMeta ?? {};
    const correctionFields = detectCorrectionFields(input);

    const ruleDraft: TicketDraft = { ...baseDraft };
    absorbUserTicketMessage(input, ruleDraft);
    const rulePatch = diffTicketDraft(baseDraft, ruleDraft);
    const ruleMeta = buildRuleFieldMeta(input, rulePatch, correctionFields);

    const llmSlots = await this.llmSlotParser.parseTicketSlots(
      input,
      baseDraft,
      listing.listingType,
    );
    const llmPatch = sanitizeLlmTicketPatch(llmSlots);
    const llmMeta = buildLlmFieldMeta(llmPatch, correctionFields);

    const merged = mergeTicketSlots({
      baseDraft,
      baseMeta,
      rulePatch,
      ruleMeta,
      llmPatch,
      llmMeta,
      correctionFields,
      listingType: listing.listingType,
    });

    return {
      ...state,
      ticketListing: {
        ...listing,
        draft: merged.draft,
        draftMeta: merged.meta,
        phase: isTicketDraftComplete(merged.draft) ? 'confirm' : 'collect',
      },
    };
  }

  private async advanceFindBuddy(
    state: ConversationState,
    messages: ChatMessageDto[],
    input: string,
  ): Promise<ConversationState> {
    let next = await applyFindBuddyInput(
      state,
      messages,
      input,
      this.activityService,
    );
    next = mergeFindBuddyFacts(next, messages, input);

    if (next.findBuddy) {
      const llmSlots = await this.llmSlotParser.parseFindBuddySlots(
        input,
        next.findBuddy,
      );
      next = {
        ...next,
        findBuddy: mergeFindBuddyFromLlm(next.findBuddy, llmSlots),
      };
    }

    return next;
  }
}
