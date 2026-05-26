export const CONVERSATION_STATE_VERSION = 1;

export type ConversationFlow =
  | 'idle'
  | 'recommend_gate'
  | 'publish_confirm'
  | 'clarify_buddy';

export interface RecommendGateState {
  activityLegacyId?: number;
  shownPostIds?: string[];
  empty?: boolean;
}

export interface PublishDraftState {
  activityLegacyId?: number;
  draftBody?: string;
}

/** 会话级结构化状态（持久化到 MongoDB） */
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
}): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'publish_confirm',
    publishDraft: {
      activityLegacyId: params.activityLegacyId,
      draftBody: params.draftBody,
    },
  };
}

export function enterClarifyBuddyState(): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'clarify_buddy',
  };
}
