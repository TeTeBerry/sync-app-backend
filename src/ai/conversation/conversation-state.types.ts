import type { TicketDraft } from '../utils/ticket-draft.parser';
import type { TicketDraftMeta } from '../parser/slot-meta.types';

export const CONVERSATION_STATE_VERSION = 1;

export type ConversationFlow = 'idle' | 'find_buddy' | 'ticket_listing';

export type FindBuddyPhase = 'pick_activity' | 'browse_pindan';

export type TicketListingPhase = 'collect' | 'confirm';

export interface FindBuddyState {
  phase: FindBuddyPhase;
  activityId?: string;
  activityKeyword?: string;
  /** 与回复中序号对应、可加入的拼单 legacyId 列表 */
  joinablePindanIds: number[];
  eventDate?: string;
  peopleCount?: number;
  city?: string;
}

export interface TicketListingState {
  listingType: 'sell' | 'buy';
  phase: TicketListingPhase;
  draft: TicketDraft;
  draftMeta?: TicketDraftMeta;
}

/** 会话级结构化状态（持久化到 MongoDB） */
export interface ConversationState {
  version: number;
  flow: ConversationFlow;
  findBuddy?: FindBuddyState;
  ticketListing?: TicketListingState;
}

export function createIdleState(): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'idle',
  };
}
