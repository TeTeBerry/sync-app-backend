export const CONVERSATION_STATE_VERSION = 1;

export type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';
import type { TravelGuideBudgetTier } from '@sync/travel-guide-contracts';

export type ConversationFlow =
  | 'idle'
  | 'publish_confirm'
  | 'clarify_buddy'
  | 'collect_post_body';

export interface PublishDraftState {
  activityLegacyId?: number;
  draftBody?: string;
  /** User explicitly chose self-post / custom body — skip existing-post gate on confirm */
  fromSelfPost?: boolean;
}

export interface TravelGuideTaskSlots {
  departure?: string;
  departureCity?: string;
  headcount?: number;
  budgetTier?: TravelGuideBudgetTier;
  selfDrive?: boolean;
  accommodationNights?: number;
}

export interface ItineraryTaskSlots {
  selectedDjIds?: string[];
  dateKey?: string;
}

export type ActiveTaskState =
  | {
      kind: 'travel_guide';
      travelGuide: TravelGuideTaskSlots;
    }
  | {
      kind: 'itinerary';
      itinerary: ItineraryTaskSlots;
    };

/** Session-level structured state (persisted to MongoDB). */
export interface ConversationState {
  version: number;
  flow: ConversationFlow;
  publishDraft?: PublishDraftState;
  activeTask?: ActiveTaskState;
}

export function createIdleState(): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'idle',
  };
}

export function enterPublishConfirmState(params: {
  activityLegacyId?: number;
  draftBody?: string;
  fromSelfPost?: boolean;
}): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'publish_confirm',
    publishDraft: {
      activityLegacyId: params.activityLegacyId,
      draftBody: params.draftBody,
      fromSelfPost: params.fromSelfPost,
    },
  };
}

export function enterClarifyBuddyState(): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'clarify_buddy',
  };
}

export function enterCollectPostBodyState(params: {
  activityLegacyId?: number;
  fromSelfPost?: boolean;
}): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'collect_post_body',
    publishDraft: {
      activityLegacyId: params.activityLegacyId,
      fromSelfPost: params.fromSelfPost,
    },
  };
}

export function enterTravelGuideCollectState(
  slots: TravelGuideTaskSlots = {},
): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'idle',
    activeTask: {
      kind: 'travel_guide',
      travelGuide: { ...slots },
    },
  };
}

export function mergeTravelGuideActiveTask(
  state: ConversationState,
  slots: TravelGuideTaskSlots,
): ConversationState {
  const prev =
    state.activeTask?.kind === 'travel_guide'
      ? state.activeTask.travelGuide
      : {};
  return {
    ...state,
    activeTask: {
      kind: 'travel_guide',
      travelGuide: { ...prev, ...slots },
    },
  };
}

export function clearActiveTask(state: ConversationState): ConversationState {
  if (!state.activeTask) {
    return state;
  }
  const { activeTask: _removed, ...rest } = state;
  return rest;
}

export function enterItineraryCollectState(
  slots: ItineraryTaskSlots = {},
): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'idle',
    activeTask: {
      kind: 'itinerary',
      itinerary: { ...slots },
    },
  };
}

export function mergeItineraryActiveTask(
  state: ConversationState,
  slots: ItineraryTaskSlots,
): ConversationState {
  const prev =
    state.activeTask?.kind === 'itinerary' ? state.activeTask.itinerary : {};
  return {
    ...state,
    activeTask: {
      kind: 'itinerary',
      itinerary: { ...prev, ...slots },
    },
  };
}

export function isActiveTravelGuideTask(
  state?: ConversationState | null,
): boolean {
  return state?.activeTask?.kind === 'travel_guide';
}

export function isActiveItineraryTask(
  state?: ConversationState | null,
): boolean {
  return state?.activeTask?.kind === 'itinerary';
}
