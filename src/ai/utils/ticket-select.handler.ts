import { TicketCreatedCardView } from '../presentation/ticket-created-card.view';
import {
  isTicketSearchFlow,
  setTicketSearchJoinableIds,
  type ConversationState,
} from '../conversation';
import {
  isListSelectionInput,
  parseListSelectionIndex,
} from './list-selection.util';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import type { TicketRow } from '../ticket/ticket-row.types';

const MAX_SELECTION = 8;

export interface TicketSelectReplyResult {
  text: string;
  ticketCard?: TicketCreatedCardView;
  nextState?: ConversationState;
}

export function shouldHandleTicketSelect(
  state: ConversationState,
  input: string,
): boolean {
  if (!isTicketSearchFlow(state)) return false;
  if (state.ticketSearch?.phase !== 'browse') return false;
  if (!isListSelectionInput(input, MAX_SELECTION)) return false;
  return (state.ticketSearch.joinableTicketIds.length ?? 0) > 0;
}

async function buildTicketCard(
  ticketId: string,
  ticketService: TicketService,
  activityService: ActivityService,
): Promise<TicketCreatedCardView | undefined> {
  const ticket = await ticketService.findById(ticketId);
  if (!ticket) return undefined;

  const activity = ticket.activityId
    ? await activityService.findByCode(ticket.activityId)
    : null;
  const slot = (ticket.seatOrSlot ?? {}) as Record<string, unknown>;
  const type = slot.type === 'buy' ? 'buy' : 'sell';
  const quantity = Number(slot.quantity ?? 1);
  const displayEventName =
    typeof slot.displayEventName === 'string'
      ? slot.displayEventName
      : undefined;

  return {
    id: ticketId,
    type,
    event:
      displayEventName ??
      activity?.name ??
      ticket.activityId ??
      '未知活动',
    seat: `${ticket.skuCode ?? 'GA'} · ${quantity}张`,
    price: Number(slot.price ?? 0),
    eventDate: slot.eventDate ? String(slot.eventDate) : undefined,
  };
}

function buildDetailText(
  row: TicketRow,
  activityName?: string,
  card?: TicketCreatedCardView,
): string {
  const slot = row.seatOrSlot ?? {};
  const type = slot.type === 'buy' ? '收票' : '出票';
  const price = slot.price != null ? `¥${slot.price}` : '价格面议';
  const qty = slot.quantity != null ? `${slot.quantity}张` : '';
  const event =
    activityName ?? row.activityId ?? card?.event ?? '未知活动';
  const seat = row.skuCode ?? 'GA';
  const seller = row.userName?.trim() || row.userId || '用户';
  const eventDate = slot.eventDate ? ` · ${slot.eventDate}` : '';
  const contact =
    typeof slot.contact === 'string' && slot.contact.trim()
      ? slot.contact.trim()
      : undefined;

  return [
    '已为你选中这条门票挂单 🎫',
    '',
    `【${type}】${event} · ${seat}${qty ? ` · ${qty}` : ''} · ${price}${eventDate}`,
    `发布者：${seller}`,
    contact ? `联系方式：${contact}` : '如需联系卖家，可点击下方卡片查看详情。',
    '',
    '点击下方卡片可跳转到门票详情。',
  ]
    .filter(Boolean)
    .join('\n');
}

export async function buildTicketSelectReply(
  input: string,
  services: {
    ticketService: TicketService;
    activityService: ActivityService;
  },
  state: ConversationState,
): Promise<TicketSelectReplyResult | null> {
  if (!shouldHandleTicketSelect(state, input)) {
    return null;
  }

  const selectionIndex = parseListSelectionIndex(input, MAX_SELECTION);
  if (!selectionIndex) {
    return {
      text: '请告诉我想查看第几条门票，例如「第一个」或「2」。',
      nextState: state,
    };
  }

  const storedIds = state.ticketSearch?.joinableTicketIds ?? [];
  const row = storedIds[selectionIndex - 1];
  if (!row) {
    return {
      text: `只有 ${storedIds.length} 条门票挂单，请输入 1-${storedIds.length} 之间的序号。`,
      nextState: state,
    };
  }

  const ticket = await services.ticketService.findById(row);
  if (!ticket) {
    const validIds = (
      await Promise.all(
        storedIds.map(async id => {
          const found = await services.ticketService.findById(id);
          return found ? id : null;
        }),
      )
    ).filter((id): id is string => Boolean(id));

    return {
      text: '该门票挂单已失效，请重新搜索或选择其他序号。',
      nextState: setTicketSearchJoinableIds(state, validIds),
    };
  }

  const activity = ticket.activityId
    ? await services.activityService.findByCode(ticket.activityId)
    : null;
  const card = await buildTicketCard(
    row,
    services.ticketService,
    services.activityService,
  );

  return {
    text: buildDetailText(ticket, activity?.name, card),
    ticketCard: card,
    nextState: {
      ...state,
      flow: 'ticket_search',
      ticketSearch: {
        ...(state.ticketSearch ?? { joinableTicketIds: [] }),
        phase: 'selected',
      },
    },
  };
}
