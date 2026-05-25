import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import {
  isTicketSearchQuery,
  parseTicketSearchParams,
  type TicketSearchParams,
} from './ticket-search.util';
import { formatSlotPrice } from './ticket-price.util';

type TicketRow = {
  _id?: unknown;
  activityId?: string;
  userId?: string;
  userName?: string;
  skuCode?: string;
  seatOrSlot?: Record<string, unknown>;
};

export interface TicketSearchReplyResult {
  text: string;
  joinableTicketIds: string[];
  activityId?: string;
  activityKeyword?: string;
  type?: 'sell' | 'buy';
}

function ticketRowId(row: TicketRow): string | undefined {
  if (row._id == null) return undefined;
  return String(row._id);
}

async function resolveActivityCode(
  params: TicketSearchParams,
  activityService: ActivityService,
): Promise<{ code?: string; name?: string }> {
  if (params.activityId) {
    const activity = await activityService.findByCode(params.activityId);
    return { code: activity?.code ?? params.activityId, name: activity?.name };
  }

  if (params.activityKeyword) {
    const activity = await activityService.matchActivity(params.activityKeyword);
    if (activity?.code) {
      return { code: activity.code, name: activity.name };
    }
  }

  return {};
}

function formatTicketRows(
  rows: TicketRow[],
  activityNames: Map<string, string>,
): string {
  if (!rows.length) {
    return '暂无匹配的门票挂单。';
  }

  return rows
    .slice(0, 8)
    .map((row, index) => {
      const slot = row.seatOrSlot ?? {};
      const type = slot.type === 'buy' ? '收票' : '出票';
      const price = formatSlotPrice(slot);
      const qty = slot.quantity != null ? `${slot.quantity}张` : '';
      const event = activityNames.get(row.activityId ?? '') ?? row.activityId ?? '未知活动';
      const seller = row.userName?.trim() || row.userId || '用户';
      const seat = row.skuCode ?? 'GA';
      const eventDate = slot.eventDate ? ` · ${slot.eventDate}` : '';
      return `${index + 1}. 【${type}】${event} · ${seat}${qty ? ` · ${qty}` : ''} · ${price}${eventDate} · ${seller}`;
    })
    .join('\n');
}

export async function buildTicketSearchResponse(
  input: string,
  services: {
    ticketService: TicketService;
    activityService: ActivityService;
  },
): Promise<TicketSearchReplyResult | null> {
  if (!isTicketSearchQuery(input)) {
    return null;
  }

  const params = parseTicketSearchParams(input);
  const { code, name } = await resolveActivityCode(params, services.activityService);

  let rows: TicketRow[] = await services.ticketService.searchListings({
    activityId: code,
    type: params.type,
  });

  if (!rows.length && code) {
    rows = await services.ticketService.searchListings({ type: params.type });
  }

  const activities = await services.activityService.findAll();
  const activityNames = new Map(
    activities.map(item => [item.code, item.name] as const),
  );

  const scopeLabel = name ?? (code ? code : '全部活动');
  const typeLabel =
    params.type === 'sell'
      ? '出票'
      : params.type === 'buy'
        ? '收票'
        : '出票/收票';

  const joinableTicketIds = rows
    .slice(0, 8)
    .map(ticketRowId)
    .filter((id): id is string => Boolean(id));

  return {
    joinableTicketIds,
    activityId: code,
    activityKeyword: name ?? params.activityKeyword,
    type: params.type,
    text: [
      `已为你搜索「${scopeLabel}」相关${typeLabel}挂单 🎫`,
      '',
      formatTicketRows(rows, activityNames),
      '',
      rows.length
        ? '看中的可以告诉我序号，或说「我要出票 / 收票」继续操作。'
        : '你可以换个活动名再查，或直接说出票/收票需求，我来帮你发布。',
    ].join('\n'),
  };
}
