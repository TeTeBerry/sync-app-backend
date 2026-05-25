export interface TicketRow {
  _id?: unknown;
  activityId?: string;
  userId?: string;
  userName?: string;
  skuCode?: string;
  seatOrSlot?: Record<string, unknown>;
}
