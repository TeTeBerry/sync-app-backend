import { ChatMessageDto } from '../presentation/chat-message.dto';
import { ActivityService } from '../../modules/activity/activity.service';
import {
  isActivityKeywordInput,
  parseConversationContext,
} from '../utils/conversation-context.parser';
import { parseActivityPickerIndex } from '../utils/activity-reply.util';
import {
  applyFindBuddyActivityCorrection,
  isFindBuddyRestartRequest,
  parseExcludedActivityRefs,
  parsePositiveActivityInput,
} from '../utils/find-buddy-correction.util';
import { parsePackageSelection } from '../utils/find-buddy-package.util';
import {
  absorbUserTicketMessage,
  isTicketConfirmMessage,
  isTicketDraftComplete,
  isSkuOnlyMessage,
  resolveActivityId,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import { mergeActivityCreateSlots } from '../pindan/find-buddy-activity-create.util';
import { detectUserIntent, isExactQuickReply } from '../utils/user-intent';
import { isTicketSearchQuery } from '../utils/ticket-search.util';
import {
  createIdleState,
  type ConversationState,
  type FindBuddyPhase,
  type FindBuddyState,
  type TicketListingPhase,
  type TicketSearchState,
} from './conversation-state.types';

export function startFindBuddyFlow(
  phase: FindBuddyPhase = 'pick_activity',
): ConversationState {
  return {
    version: 1,
    flow: 'find_buddy',
    findBuddy: {
      phase,
      joinablePindanIds: [],
    },
  };
}

export function startTicketListingFlow(
  listingType: 'sell' | 'buy',
  draft?: TicketDraft,
): ConversationState {
  const mergedDraft: TicketDraft = {
    type: listingType,
    ...(draft ?? {}),
  };
  const phase: TicketListingPhase = isTicketDraftComplete(mergedDraft)
    ? 'confirm'
    : 'collect';

  return {
    version: 1,
    flow: 'ticket_listing',
    ticketListing: {
      listingType,
      phase,
      draft: mergedDraft,
      draftMeta: {},
    },
  };
}

export function startTicketSearchFlow(
  joinableTicketIds: string[] = [],
  context?: Pick<TicketSearchState, 'activityId' | 'activityKeyword' | 'type'>,
): ConversationState {
  return {
    version: 1,
    flow: 'ticket_search',
    ticketSearch: {
      phase: 'browse',
      joinableTicketIds,
      ...context,
    },
  };
}

export function resetToIdle(): ConversationState {
  return createIdleState();
}

function transferTicketDraftForListingType(
  state: ConversationState,
  listingType: 'sell' | 'buy',
): TicketDraft | undefined {
  const prev = state.ticketListing?.draft;
  if (!prev) return undefined;

  return {
    activityId: prev.activityId,
    activityKeyword: prev.activityKeyword,
    eventDate: prev.eventDate,
    skuCode: prev.skuCode,
    quantity: prev.quantity,
    price: prev.price,
    priceMax: prev.priceMax,
    contact: prev.contact,
    type: listingType,
  };
}

function mergeSharedSlotsIntoTicketDraft(
  state: ConversationState,
  draft?: TicketDraft,
): TicketDraft | undefined {
  const merged: TicketDraft = { ...(draft ?? {}) };

  const findBuddy = state.findBuddy;
  if (findBuddy) {
    merged.activityId = merged.activityId ?? findBuddy.activityId;
    merged.activityKeyword = merged.activityKeyword ?? findBuddy.activityKeyword;
    merged.eventDate = merged.eventDate ?? findBuddy.eventDate;
  }

  const ticketSearch = state.ticketSearch;
  if (ticketSearch) {
    merged.activityId = merged.activityId ?? ticketSearch.activityId;
    merged.activityKeyword =
      merged.activityKeyword ?? ticketSearch.activityKeyword;
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

function mergeSharedSlotsIntoFindBuddy(
  state: ConversationState,
  next: ConversationState,
): ConversationState {
  if (!next.findBuddy) return next;

  const prevFindBuddy = state.findBuddy;
  const ticketDraft = state.ticketListing?.draft;
  const ticketSearch = state.ticketSearch;

  return {
    ...next,
    findBuddy: {
      ...next.findBuddy,
      activityId:
        next.findBuddy.activityId ??
        prevFindBuddy?.activityId ??
        ticketDraft?.activityId ??
        ticketSearch?.activityId,
      activityKeyword:
        next.findBuddy.activityKeyword ??
        prevFindBuddy?.activityKeyword ??
        ticketDraft?.activityKeyword ??
        ticketSearch?.activityKeyword,
      eventDate:
        next.findBuddy.eventDate ??
        prevFindBuddy?.eventDate ??
        ticketDraft?.eventDate,
    },
  };
}

function startTicketListingFromIntent(
  state: ConversationState,
  listingType: 'sell' | 'buy',
): ConversationState {
  if (
    state.flow === 'ticket_listing' &&
    state.ticketListing?.listingType === listingType
  ) {
    return state;
  }

  const baseDraft =
    state.flow === 'ticket_listing'
      ? transferTicketDraftForListingType(state, listingType)
      : undefined;

  const draft = mergeSharedSlotsIntoTicketDraft(state, baseDraft);
  return startTicketListingFlow(listingType, draft);
}

export function isFindBuddyFlow(state: ConversationState): boolean {
  return state.flow === 'find_buddy' && Boolean(state.findBuddy);
}

export function isTicketListingFlow(state: ConversationState): boolean {
  return state.flow === 'ticket_listing' && Boolean(state.ticketListing);
}

export function isTicketSearchFlow(state: ConversationState): boolean {
  return state.flow === 'ticket_search' && Boolean(state.ticketSearch);
}

/** 快捷回复 / 显式换话题时切换流程 */
export function applyFlowSwitch(
  state: ConversationState,
  input: string,
): ConversationState | null {
  if (isFindBuddyRestartRequest(input)) {
    return startFindBuddyFlow('pick_activity');
  }

  const intent = detectUserIntent(input);

  if (
    state.flow === 'find_buddy' &&
    state.findBuddy &&
    intent === 'find_buddy'
  ) {
    return null;
  }

  if (
    state.flow === 'ticket_listing' &&
    state.ticketListing &&
    ((intent === 'sell_ticket' &&
      state.ticketListing.listingType === 'sell') ||
      (intent === 'buy_ticket' && state.ticketListing.listingType === 'buy'))
  ) {
    return null;
  }

  if (
    state.flow === 'ticket_search' &&
    state.ticketSearch &&
    intent === 'search_ticket' &&
    isTicketSearchQuery(input)
  ) {
    return null;
  }

  if (!isExactQuickReply(input)) {
    if (intent === 'find_buddy') {
      if (state.flow === 'find_buddy') return null;
      return mergeSharedSlotsIntoFindBuddy(
        state,
        startFindBuddyFlow('pick_activity'),
      );
    }
    if (intent === 'sell_ticket') {
      return startTicketListingFromIntent(state, 'sell');
    }
    if (intent === 'buy_ticket') {
      return startTicketListingFromIntent(state, 'buy');
    }
    return null;
  }

  if (intent === 'find_buddy') {
    return mergeSharedSlotsIntoFindBuddy(
      state,
      startFindBuddyFlow('pick_activity'),
    );
  }
  if (intent === 'sell_ticket') {
    return startTicketListingFromIntent(state, 'sell');
  }
  if (intent === 'buy_ticket') {
    return startTicketListingFromIntent(state, 'buy');
  }
  if (intent === 'near_events') return resetToIdle();
  return null;
}

export function applyTicketListingInput(
  state: ConversationState,
  input: string,
): ConversationState {
  if (!state.ticketListing) return state;
  if (isTicketConfirmMessage(input)) {
    return {
      ...state,
      ticketListing: {
        ...state.ticketListing,
        phase: 'confirm',
      },
    };
  }

  const draft: TicketDraft = {
    ...state.ticketListing.draft,
    type: state.ticketListing.listingType,
  };
  absorbUserTicketMessage(input, draft);

  return {
    ...state,
    ticketListing: {
      ...state.ticketListing,
      draft,
      phase: isTicketDraftComplete(draft) ? 'confirm' : 'collect',
    },
  };
}

export async function applyFindBuddyInput(
  state: ConversationState,
  messages: ChatMessageDto[],
  input: string,
  activityService: ActivityService,
): Promise<ConversationState> {
  if (!state.findBuddy) return state;

  const findBuddy = applyFindBuddyActivityCorrection(state.findBuddy, input);
  const positiveActivity = parsePositiveActivityInput(input);

  const packageOptions = findBuddy.packageOptions ?? [];
  const isPackagePickPhase =
    findBuddy.phase === 'pick_package' && packageOptions.length >= 2;
  const isPackageSelectionInput =
    isPackagePickPhase &&
    parsePackageSelection(input, packageOptions) != null;

  if (
    isPackagePickPhase ||
    findBuddy.phase === 'collect_create_pindan' ||
    findBuddy.phase === 'confirm_create_pindan' ||
    isPackageSelectionInput
  ) {
    return { ...state, findBuddy };
  }

  if (
    findBuddy.phase !== 'pick_activity' &&
    !positiveActivity &&
    !parseActivityPickerIndex(input)
  ) {
    if (findBuddy !== state.findBuddy) {
      return { ...state, findBuddy };
    }
    return state;
  }

  const ctx = parseConversationContext(messages, input);
  const ignoreHistoricalActivity =
    parseExcludedActivityRefs(input).length > 0 ||
    isFindBuddyRestartRequest(input);

  let activityId = findBuddy.activityId;
  let activityKeyword = findBuddy.activityKeyword;
  if (!ignoreHistoricalActivity) {
    activityId = activityId ?? ctx.activityId;
    activityKeyword = activityKeyword ?? ctx.activityKeyword;
  }

  const pickerIndex = parseActivityPickerIndex(input);
  if (pickerIndex) {
    const activities = await activityService.findAll();
    const picked = activities[pickerIndex - 1];
    if (picked) {
      activityId = picked.code;
      activityKeyword = picked.name;
    }
  } else if (positiveActivity) {
    const activity = await activityService.matchActivity(positiveActivity);
    activityId = activity?.code ?? resolveActivityId(positiveActivity);
    activityKeyword = positiveActivity;
  } else if (isActivityKeywordInput(input)) {
    const activity = await activityService.matchActivity(input.trim());
    activityId = activity?.code ?? resolveActivityId(input.trim());
    activityKeyword = input.trim();
  } else if (!activityId) {
    const resolved = resolveActivityId(input.trim());
    if (resolved && input.trim().length <= 24) {
      activityId = resolved;
      activityKeyword = input.trim();
    }
  }

  if (!activityId && activityKeyword) {
    const activity = await activityService.matchActivity(activityKeyword);
    activityId = activity?.code ?? resolveActivityId(activityKeyword);
  }

  if (!activityId && !activityKeyword) {
    return {
      ...state,
      findBuddy: {
        ...findBuddy,
        eventDate: ctx.eventDate ?? findBuddy.eventDate,
        peopleCount: ctx.peopleCount ?? findBuddy.peopleCount,
        city: ctx.city ?? findBuddy.city,
      },
    };
  }

  const nextFindBuddy: FindBuddyState = {
    ...findBuddy,
    phase: 'browse_pindan',
    activityId,
    activityKeyword,
    joinablePindanIds: [],
    eventDate: ctx.eventDate ?? findBuddy.eventDate,
    peopleCount: ctx.peopleCount ?? findBuddy.peopleCount,
    city: ctx.city ?? findBuddy.city,
  };

  return {
    ...state,
    findBuddy: nextFindBuddy,
  };
}

export function setFindBuddyJoinableIds(
  state: ConversationState,
  joinablePindanIds: number[],
): ConversationState {
  if (!state.findBuddy) return state;
  return {
    ...state,
    findBuddy: {
      ...state.findBuddy,
      phase: 'browse_pindan',
      joinablePindanIds,
    },
  };
}

export function setTicketSearchJoinableIds(
  state: ConversationState,
  joinableTicketIds: string[],
  context?: Pick<TicketSearchState, 'activityId' | 'activityKeyword' | 'type'>,
): ConversationState {
  if (!state.ticketSearch) {
    return startTicketSearchFlow(joinableTicketIds, context);
  }

  return {
    ...state,
    flow: 'ticket_search',
    ticketSearch: {
      ...state.ticketSearch,
      phase: 'browse',
      joinableTicketIds,
      activityId: context?.activityId ?? state.ticketSearch.activityId,
      activityKeyword:
        context?.activityKeyword ?? state.ticketSearch.activityKeyword,
      type: context?.type ?? state.ticketSearch.type,
    },
  };
}

export function mergeFindBuddyFacts(
  state: ConversationState,
  messages: ChatMessageDto[],
  input: string,
): ConversationState {
  if (!state.findBuddy) return state;

  const trimmed = input.trim();
  if (parseActivityPickerIndex(trimmed) || isActivityKeywordInput(trimmed)) {
    return state;
  }

  if (state.findBuddy.phase === 'collect_create_pindan') {
    return {
      ...state,
      findBuddy: mergeActivityCreateSlots(state.findBuddy, input),
    };
  }

  const ctx = parseConversationContext(messages, input);
  return {
    ...state,
    findBuddy: {
      ...state.findBuddy,
      eventDate: ctx.eventDate ?? state.findBuddy.eventDate,
      peopleCount: ctx.peopleCount ?? state.findBuddy.peopleCount,
      city: ctx.city ?? state.findBuddy.city,
      packageName: state.findBuddy.packageName,
      hotelName: state.findBuddy.hotelName,
      location: state.findBuddy.location,
      budget: ctx.budget ?? state.findBuddy.budget,
      packagePrice: state.findBuddy.packagePrice,
      transportNote: state.findBuddy.transportNote,
      packageOptions: state.findBuddy.packageOptions,
      selectedPackageIndex: state.findBuddy.selectedPackageIndex,
    },
  };
}

/** 每条用户消息进入 deterministic 链之前调用 */
export async function advanceConversationState(
  state: ConversationState,
  messages: ChatMessageDto[],
  input: string,
  activityService: ActivityService,
): Promise<ConversationState> {
  const switched = applyFlowSwitch(state, input);
  let next = switched ?? state;

  if (next.flow === 'ticket_listing') {
    if (switched) {
      return next;
    }
    return applyTicketListingInput(next, input);
  }

  if (next.flow === 'find_buddy') {
    if (switched) {
      return next;
    }
    next = await applyFindBuddyInput(next, messages, input, activityService);
    return mergeFindBuddyFacts(next, messages, input);
  }

  return next;
}
