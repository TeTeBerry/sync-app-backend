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
}
