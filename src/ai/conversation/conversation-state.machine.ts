import { ChatMessageDto } from '../dto/chat.dto';
import { ActivityService } from '../../modules/activity/activity.service';
import {
  isActivityKeywordInput,
  parseConversationContext,
} from '../utils/conversation-context.parser';
import { parseActivityPickerIndex } from '../utils/activity-reply.util';
import {
  absorbUserTicketMessage,
  isTicketConfirmMessage,
  isTicketDraftComplete,
  resolveActivityId,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import { detectUserIntent, isExactQuickReply } from '../utils/user-intent';
import {
  createIdleState,
  type ConversationState,
  type FindBuddyPhase,
  type FindBuddyState,
  type TicketListingPhase,
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

export function resetToIdle(): ConversationState {
  return createIdleState();
}

export function isFindBuddyFlow(state: ConversationState): boolean {
  return state.flow === 'find_buddy' && Boolean(state.findBuddy);
}

export function isTicketListingFlow(state: ConversationState): boolean {
  return state.flow === 'ticket_listing' && Boolean(state.ticketListing);
}

/** 快捷回复 / 显式换话题时切换流程 */
export function applyFlowSwitch(
  state: ConversationState,
  input: string,
): ConversationState | null {
  if (!isExactQuickReply(input)) {
    const intent = detectUserIntent(input);
    if (intent === 'find_buddy') return startFindBuddyFlow('pick_activity');
    if (intent === 'sell_ticket') return startTicketListingFlow('sell');
    if (intent === 'buy_ticket') return startTicketListingFlow('buy');
    return null;
  }

  const intent = detectUserIntent(input);
  if (intent === 'find_buddy') return startFindBuddyFlow('pick_activity');
  if (intent === 'sell_ticket') return startTicketListingFlow('sell');
  if (intent === 'buy_ticket') return startTicketListingFlow('buy');
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
  if (!state.findBuddy || state.findBuddy.phase !== 'pick_activity') {
    return state;
  }

  const ctx = parseConversationContext(messages, input);
  let activityId = ctx.activityId;
  let activityKeyword = ctx.activityKeyword;

  const pickerIndex = parseActivityPickerIndex(input);
  if (pickerIndex) {
    const activities = await activityService.findAll();
    const picked = activities[pickerIndex - 1];
    if (picked) {
      activityId = picked.code;
      activityKeyword = picked.name;
    }
  } else if (isActivityKeywordInput(input)) {
    const activity = await activityService.matchActivity(input.trim());
    activityId = activity?.code ?? resolveActivityId(input.trim());
    activityKeyword = input.trim();
  } else {
    const resolved = resolveActivityId(input.trim());
    if (resolved && input.trim().length <= 24) {
      activityId = resolved;
      activityKeyword = input.trim();
    }
  }

  if (!activityId && !activityKeyword) {
    return state;
  }

  const findBuddy: FindBuddyState = {
    ...state.findBuddy,
    phase: 'browse_pindan',
    activityId,
    activityKeyword,
    joinablePindanIds: [],
    eventDate: ctx.eventDate ?? state.findBuddy.eventDate,
    peopleCount: ctx.peopleCount ?? state.findBuddy.peopleCount,
    city: ctx.city ?? state.findBuddy.city,
  };

  return {
    ...state,
    findBuddy,
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

  const ctx = parseConversationContext(messages, input);
  return {
    ...state,
    findBuddy: {
      ...state.findBuddy,
      eventDate: ctx.eventDate ?? state.findBuddy.eventDate,
      peopleCount: ctx.peopleCount ?? state.findBuddy.peopleCount,
      city: ctx.city ?? state.findBuddy.city,
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
