const AVATAR_POOL = [
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=60&q=80',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=60&q=80',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&q=80',
];

type TicketLean = {
  _id?: string;
  activityId?: string;
  userId?: string;
  userName?: string;
  skuCode?: string;
  seatOrSlot?: {
    type?: string;
    quantity?: number;
    price?: number;
    displayEventName?: string;
  };
  createdAt?: string | Date;
};

export type TicketListingUi = {
  id: string;
  type: 'sell' | 'buy';
  event: string;
  seat: string;
  price: number;
  originalPrice: number;
  seller: string;
  avatar: string;
  tag: string;
  tone: 'primary' | 'secondary' | 'amber' | 'cyan';
  time: string;
  verified: boolean;
};

function resolveTicketSellerName(ticket: TicketLean): string {
  if (ticket.userName?.trim()) {
    return ticket.userName.trim();
  }

  const userId = ticket.userId?.trim();
  if (!userId) return '用户';
  if (!/^\d{10,}-/.test(userId)) {
    return userId;
  }

  return '用户';
}

function ticketTag(
  type: 'sell' | 'buy',
  price: number,
): { tag: string; tone: TicketListingUi['tone'] } {
  if (type === 'buy') {
    return { tag: price >= 1000 ? '高价求' : '求购', tone: 'secondary' };
  }
  return { tag: '在售', tone: 'primary' };
}

function formatRelativeTime(iso?: string | Date): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const hours = Math.max(1, Math.floor(diff / (1000 * 60 * 60)));
  if (hours < 24) return `${hours}小时前`;
  return `${Math.floor(hours / 24)}天前`;
}

export function mapTicketsToListingUi(
  tickets: TicketLean[],
  activityNameMap: Map<string, string>,
): TicketListingUi[] {
  return tickets.map((ticket, index) => {
    const slot = ticket.seatOrSlot ?? {};
    const type = slot.type === 'buy' ? 'buy' : 'sell';
    const quantity = slot.quantity ?? 1;
    const price = Number(slot.price ?? (type === 'sell' ? 880 : 560));
    const { tag, tone } = ticketTag(type, price);

    return {
      id: String(ticket._id ?? index),
      type,
      event:
        slot.displayEventName ??
        activityNameMap.get(ticket.activityId ?? '') ??
        ticket.activityId ??
        '未知活动',
      seat: `${ticket.skuCode ?? 'GA'} · ${quantity}张`,
      price,
      originalPrice: type === 'sell' ? Math.round(price * 1.35) : 0,
      seller: resolveTicketSellerName(ticket),
      avatar: AVATAR_POOL[index % AVATAR_POOL.length],
      tag,
      tone,
      time: formatRelativeTime(ticket.createdAt),
      verified: true,
    };
  });
}
