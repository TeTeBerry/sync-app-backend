export const CONVERSATION_STATE_VERSION = 1;

export type ConversationFlow =
  | 'idle'
  | 'recommend_gate'
  | 'publish_confirm'
  | 'clarify_buddy'
  | 'collect_post_body';

export interface RecommendGateState {
  activityLegacyId?: number;
  shownPostIds?: string[];
  empty?: boolean;
}

export interface PublishDraftState {
  activityLegacyId?: number;
  draftBody?: string;
  /** User explicitly chose self-post / custom body — skip existing-post gate on confirm */
  fromSelfPost?: boolean;
}

/** Session-level structured state (persisted to MongoDB). */
export interface ConversationState {
  version: number;
  flow: ConversationFlow;
  gate?: RecommendGateState;
  publishDraft?: PublishDraftState;
}

export function createIdleState(): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'idle',
  };
}

export function enterRecommendGateState(params: {
  activityLegacyId?: number;
  shownPostIds?: string[];
  empty?: boolean;
}): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'recommend_gate',
    gate: {
      activityLegacyId: params.activityLegacyId,
      shownPostIds: params.shownPostIds,
      empty: params.empty,
    },
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
