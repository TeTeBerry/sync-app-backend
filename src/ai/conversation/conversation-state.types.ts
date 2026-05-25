import type { TicketDraft } from '../utils/ticket-draft.parser';
import type { TicketDraftMeta } from '../parser/slot-meta.types';

export const CONVERSATION_STATE_VERSION = 1;

export type ConversationFlow = 'idle' | 'find_buddy' | 'ticket_listing';

export type FindBuddyPhase =
  | 'pick_activity'
  | 'pick_package'
  | 'browse_pindan'
  | 'confirm_create_pindan';

/** 套餐海报上的可选套餐（如 VAC 3天2晚 / 4天3晚） */
export interface FindBuddyPackageOption {
  packageName?: string;
  packagePrice?: number;
  eventDate?: string;
  /** 如「3天2晚」 */
  duration?: string;
}

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
  /** 套餐/机酒名称（来自截图识别） */
  packageName?: string;
  /** 酒店名称（来自订单截图） */
  hotelName?: string;
  /** 目的地/酒店地址 */
  location?: string;
  /** 人均预算（元/人） */
  budget?: number;
  /** 套餐/订单总价（元） */
  packagePrice?: number;
  /** 交通/穿梭巴士说明（来自套餐图） */
  transportNote?: string;
  /** 图片识别出的多个套餐选项（需用户选择） */
  packageOptions?: FindBuddyPackageOption[];
  /** 用户已选套餐在 packageOptions 中的下标 */
  selectedPackageIndex?: number;
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
