import type { TicketDraft } from '../utils/ticket-draft.parser';

export type SlotSource = 'rule' | 'llm' | 'vision' | 'knowledge' | 'catalog' | 'rag' | 'account';

export interface FieldMeta {
  source: SlotSource;
  /** 0~1，越高越优先 */
  confidence: number;
  /** 本轮是否为用户明确纠正 */
  corrected?: boolean;
}

export type TicketDraftField = keyof Pick<
  TicketDraft,
  | 'activityKeyword'
  | 'activityId'
  | 'eventDate'
  | 'skuCode'
  | 'quantity'
  | 'price'
  | 'contact'
>;

export type TicketDraftMeta = Partial<Record<TicketDraftField, FieldMeta>>;

export const TICKET_DRAFT_FIELDS: TicketDraftField[] = [
  'activityKeyword',
  'activityId',
  'eventDate',
  'skuCode',
  'quantity',
  'price',
  'contact',
];
