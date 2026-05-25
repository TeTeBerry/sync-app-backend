export interface LlmTicketSlotResult {
  activityKeyword?: string | null;
  activityId?: string | null;
  eventDate?: string | null;
  skuCode?: string | null;
  quantity?: number | null;
  price?: number | null;
  contact?: string | null;
}

export interface LlmFindBuddySlotResult {
  activityKeyword?: string | null;
  activityId?: string | null;
  eventDate?: string | null;
  peopleCount?: number | null;
  city?: string | null;
  packageName?: string | null;
  hotelName?: string | null;
  location?: string | null;
  /** 人均预算（仅当图片明确标注 /人 时填写） */
  budget?: number | null;
  /** 套餐/订单总价（如 3天2晚 1738） */
  packagePrice?: number | null;
  /** total=套餐总价；per_person=人均 */
  priceUnit?: 'total' | 'per_person' | null;
  /** 交通/穿梭巴士等说明 */
  transportNote?: string | null;
  /** 海报/截图中的多个套餐选项（如有） */
  packageOptions?: Array<{
    packageName?: string | null;
    packagePrice?: number | null;
    eventDate?: string | null;
    duration?: string | null;
    priceUnit?: 'total' | 'per_person' | null;
  }> | null;
}

export type LlmFindBuddyVisionResult = LlmFindBuddySlotResult;
