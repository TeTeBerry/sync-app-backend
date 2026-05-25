import type { TicketDraft } from '../utils/ticket-draft.parser';
import type { TicketDraftMeta } from '../parser/slot-meta.types';

export const CONVERSATION_STATE_VERSION = 1;

export type ConversationFlow =
  | 'idle'
  | 'find_buddy'
  | 'ticket_listing'
  | 'ticket_search';

export type FindBuddyPhase =
  | 'pick_activity'
  | 'pick_package'
  | 'browse_pindan'
  | 'collect_create_pindan'
  | 'confirm_create_pindan';

/** 套餐海报上的可选套餐（如 VAC 3天2晚 / 4天3晚） */
export interface FindBuddyPackageOption {
  packageName?: string;
  packagePrice?: number;
  eventDate?: string;
  /** 如「3天2晚」 */
  duration?: string;
}

export type TicketListingPhase = 'collect' | 'confirm' | 'browse_matches';

export type TicketSearchPhase = 'browse' | 'selected';

export interface TicketSearchState {
  phase: TicketSearchPhase;
  /** 与搜索结果序号对应的 Mongo ticket _id 列表 */
  joinableTicketIds: string[];
  activityId?: string;
  activityKeyword?: string;
  type?: 'sell' | 'buy';
}

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
  /** 人均预算；若 budgetScope=total 则为整单预算，展示/落库前按人数折算 */
  budget?: number;
  /** 预算区间下限；含义由 budgetScope 决定 */
  budgetMin?: number;
  /** 预算区间上限；含义由 budgetScope 决定 */
  budgetMax?: number;
  /** total=整单预算（如 1000-1200）；per_person=人均（如 人均500） */
  budgetScope?: 'total' | 'per_person';
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
  /** 确认前搜到的反向挂单 _id，与回复序号对应 */
  matchTicketIds?: string[];
}

/** 会话级结构化状态（持久化到 MongoDB） */
export interface ConversationState {
  version: number;
  flow: ConversationFlow;
  findBuddy?: FindBuddyState;
  ticketListing?: TicketListingState;
  ticketSearch?: TicketSearchState;
  /** 空闲态上传图片后，门票/找搭子 OCR 均有一定置信度时的消歧标记 */
  pendingImageDisambiguation?: boolean;
}

export function createIdleState(): ConversationState {
  return {
    version: CONVERSATION_STATE_VERSION,
    flow: 'idle',
  };
}
