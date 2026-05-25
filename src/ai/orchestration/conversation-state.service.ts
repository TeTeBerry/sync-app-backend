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
import { ActivityKnowledgeService } from '../rag/activity-knowledge.service';
import { detectCorrectionFields } from '../parser/correction-intent.util';
import { FindBuddyImageParserService } from '../parser/find-buddy-image-parser.service';
import { mergeFindBuddyState, isLockedPackageFlow } from '../parser/find-buddy-merge.util';
import { applyFindBuddyActivityCorrection } from '../utils/find-buddy-correction.util';
import { LlmSlotParserService } from '../parser/llm-slot-parser.service';
import { TicketImageParserService } from '../parser/ticket-image-parser.service';
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
 * Agentic 状态机：规则 + LLM 槽位解析 → 带来源/置信度的结构化存储
 */
@Injectable()
export class ConversationStateService {
  constructor(
    private readonly activityService: ActivityService,
    private readonly activityKnowledgeService: ActivityKnowledgeService,
    private readonly llmSlotParser: LlmSlotParserService,
    private readonly ticketImageParser: TicketImageParserService,
    private readonly findBuddyImageParser: FindBuddyImageParserService,
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
    userPhone?: string,
    image?: string,
  ): Promise<ConversationState> {
    const switched = applyFlowSwitch(state, input);
    const next = switched ?? state;

    if (next.flow === 'ticket_listing') {
      if (switched && !image?.trim()) return next;
      return this.advanceTicketListing(next, input, userPhone, image);
    }

    if (next.flow === 'find_buddy') {
      if (switched && !image?.trim()) return next;
      return this.advanceFindBuddy(next, messages, input, image);
    }

    return next;
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

  private async advanceTicketListing(
    state: ConversationState,
    input: string,
    userPhone?: string,
    image?: string,
  ): Promise<ConversationState> {
    if (isTicketConfirmMessage(input)) {
      return applyTicketListingInput(state, input);
    }

    const listing = state.ticketListing!;
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

    if (
      userPhone?.trim() &&
      merged.draft.contact === userPhone.trim()
    ) {
      merged.meta.contact = {
        source: 'account',
        confidence: 1,
      };
    }

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
    image?: string,
  ): Promise<ConversationState> {
    const rawBase =
      state.findBuddy ??
      ({
        phase: 'pick_activity',
        joinablePindanIds: [],
      } as import('../conversation/conversation-state.types').FindBuddyState);

    const base = applyFindBuddyActivityCorrection(rawBase, input);

    const visionRaw = image?.trim()
      ? await this.findBuddyImageParser.parseFindBuddyImage(image, input)
      : null;

    let ruleState = await applyFindBuddyInput(
      { ...state, findBuddy: { ...base } },
      messages,
      input,
      this.activityService,
    );
    ruleState = mergeFindBuddyFacts(ruleState, messages, input);

    const lockedPackageFlow = isLockedPackageFlow(ruleState.findBuddy ?? base);
    const llmRaw = lockedPackageFlow
      ? null
      : await this.llmSlotParser.parseFindBuddySlots(
          input,
          ruleState.findBuddy ?? base,
        );

    let mergedFindBuddy = mergeFindBuddyState({
      base,
      visionRaw,
      ruleState: ruleState.findBuddy ?? base,
      llmRaw,
      input,
    });

    mergedFindBuddy = applyFindBuddyActivityCorrection(mergedFindBuddy, input);

    return {
      ...state,
      flow: 'find_buddy',
      findBuddy: mergedFindBuddy,
    };
  }
}