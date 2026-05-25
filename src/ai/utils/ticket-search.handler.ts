import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import { createTicketTool } from '../functions/ticket.tool';
import {
  isTicketSearchQuery,
  parseTicketSearchParams,
  type TicketSearchParams,
} from './ticket-search.util';

type TicketRow = {
  _id?: unknown;
  activityId?: string;
  userId?: string;
  userName?: string;
  skuCode?: string;
  seatOrSlot?: Record<string, unknown>;
};

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
      const price = slot.price != null ? `¥${slot.price}` : '价格面议';
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
): Promise<string | null> {
  if (!isTicketSearchQuery(input)) {
    return null;
  }

  const params = parseTicketSearchParams(input);
  const { code, name } = await resolveActivityCode(params, services.activityService);

  const [searchTool] = createTicketTool(
    services.ticketService,
    services.activityService,
  );

  const raw = await searchTool.invoke({
    activityId: code,
    type: params.type,
  });

  let rows: TicketRow[] = [];
  if (typeof raw === 'string' && raw.startsWith('[')) {
    rows = JSON.parse(raw) as TicketRow[];
  }

  if (!rows.length && code) {
    const fallbackRaw = await searchTool.invoke({ type: params.type });
    if (typeof fallbackRaw === 'string' && fallbackRaw.startsWith('[')) {
      rows = JSON.parse(fallbackRaw) as TicketRow[];
    }
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

  return [
    `已为你搜索「${scopeLabel}」相关${typeLabel}挂单 🎫`,
    '',
    formatTicketRows(rows, activityNames),
    '',
    rows.length
      ? '看中的可以告诉我序号，或说「我要出票 / 收票」继续操作。'
      : '你可以换个活动名再查，或直接说出票/收票需求，我来帮你发布。',
  ].join('\n');
}
