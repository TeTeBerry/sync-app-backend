import { Injectable } from '@nestjs/common';
import {
  applyTicketListingInput,
  startTicketListingFlow,
  type ConversationState,
} from '../conversation';
import {
  absorbUserTicketMessage,
  isTicketConfirmMessage,
  isTicketDraftComplete,
  isSkuOnlyMessage,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import { ActivityKnowledgeService } from '../rag/activity-knowledge.service';
import { detectCorrectionFields } from '../parser/correction-intent.util';
import { TicketImageParserService } from '../parser/ticket-image-parser.service';
import { LlmSlotParserService } from '../parser/llm-slot-parser.service';
import {
  buildLlmFieldMeta,
  buildRuleFieldMeta,
  buildVisionFieldMeta,
  diffTicketDraft,
} from '../parser/rule-slot-meta.util';
import type { TicketDraftMeta } from '../parser/slot-meta.types';
import {
  mergeTicketSlots,
  sanitizeLlmTicketPatch,
} from '../parser/slot-merge.util';

/**
 * 专门负责票务挂单流程的状态推进
 */
@Injectable()
export class TicketListingStateAdvancer {
  constructor(
    private readonly activityKnowledgeService: ActivityKnowledgeService,
    private readonly llmSlotParser: LlmSlotParserService,
    private readonly ticketImageParser: TicketImageParserService,
  ) {}

  async advance(
    state: ConversationState,
    input: string,
    userPhone?: string,
    image?: string,
  ): Promise<ConversationState> {
    if (isTicketConfirmMessage(input)) {
      return applyTicketListingInput(state, input);
    }

    const listing = state.ticketListing;
    if (!listing) return state;
    const baseDraft: TicketDraft = {
      ...listing.draft,
      type: listing.listingType,
    };
    const baseMeta: TicketDraftMeta = { ...(listing.draftMeta ?? {}) };
    const correctionFields = detectCorrectionFields(input);

    const visionSlots = image?.trim()
      ? await this.ticketImageParser.parseTicketImage(
          image,
          listing.listingType,
          input,
        )
      : null;
    const visionPatch = sanitizeLlmTicketPatch(visionSlots);
    const visionMeta = buildVisionFieldMeta(visionPatch);

    const ruleDraft: TicketDraft = { ...baseDraft };
    absorbUserTicketMessage(input, ruleDraft, userPhone);
    const rulePatch = diffTicketDraft(baseDraft, ruleDraft);
    const ruleMeta = buildRuleFieldMeta(input, rulePatch, correctionFields);

    const skipLlmParse = isSkuOnlyMessage(input);
    const llmSlots = skipLlmParse
      ? null
      : await this.llmSlotParser.parseTicketSlots(
          input,
          baseDraft,
          listing.listingType,
        );
    const llmPatch = sanitizeLlmTicketPatch(llmSlots);
    const llmMeta = buildLlmFieldMeta(llmPatch, correctionFields);

    const merged = mergeTicketSlots({
      baseDraft,
      baseMeta,
      visionPatch,
      visionMeta,
      rulePatch,
      ruleMeta,
      llmPatch,
      llmMeta,
      correctionFields,
      listingType: listing.listingType,
    });

    await this.enrichDraftFromKnowledge(merged.draft, merged.meta);

    if (rulePatch.price != null && ruleDraft.priceMax == null) {
      delete merged.draft.priceMax;
    }
    if (ruleDraft.priceMax != null && ruleDraft.priceMax > (ruleDraft.price ?? 0)) {
      merged.draft.priceMax = ruleDraft.priceMax;
    }

    if (isSkuOnlyMessage(input)) {
      if (rulePatch.skuCode) {
        merged.draft.skuCode = rulePatch.skuCode;
        if (ruleMeta.skuCode) {
          merged.meta.skuCode = ruleMeta.skuCode;
        }
      }
      if (!baseDraft.activityId && !baseDraft.activityKeyword) {
        delete merged.draft.activityId;
        delete merged.draft.activityKeyword;
        delete merged.draft.eventDate;
        delete merged.meta.activityId;
        delete merged.meta.activityKeyword;
        delete merged.meta.eventDate;
      }
    }

    const phone = userPhone?.trim();
    if (phone && !merged.draft.contact?.trim()) {
      merged.draft.contact = phone;
      merged.meta.contact = { source: 'account', confidence: 1 };
    } else if (phone && merged.draft.contact === phone) {
      merged.meta.contact = { source: 'account', confidence: 1 };
    }

    return {
      ...state,
      ticketListing: {
        ...listing,
        draft: merged.draft,
        draftMeta: merged.meta,
        phase: isTicketDraftComplete(merged.draft, userPhone) ? 'confirm' : 'collect',
      },
    };
  }

  async advanceFromImage(
    listingType: 'sell' | 'buy' | undefined,
    visionPatch: Partial<TicketDraft>,
    input: string,
    userPhone?: string,
    image?: string,
  ): Promise<ConversationState> {
    const draft: TicketDraft = { type: listingType, ...visionPatch };
    const next = startTicketListingFlow(listingType, draft);
    return this.advance(next, input, userPhone, image);
  }

  private async enrichDraftFromKnowledge(
    draft: TicketDraft,
    meta: TicketDraftMeta,
  ): Promise<void> {
    if (!draft.activityId || draft.eventDate) return;

    const resolved = await this.activityKnowledgeService.resolveDefaultEventDate(
      draft.activityId,
      draft.activityKeyword,
    );
    if (!resolved) return;

    draft.eventDate = resolved.eventDate;
    meta.eventDate = {
      source: resolved.source,
      confidence: resolved.source === 'knowledge' ? 0.92 : 0.85,
    };
  }
}
