import { formatSlotPrice } from '../utils/ticket-price.util';
import type { TicketRow } from './ticket-row.types';

export interface FormatRowContext {
  activityNames: Map<string, string>;
  /** 是否优先使用行内的 displayEventName */
  preferDisplayName?: boolean;
}

export class TicketRowFormatter {
  static id(row: TicketRow): string | undefined {
    return row._id == null ? undefined : String(row._id);
  }

  static typeLabel(row: TicketRow): '收票' | '出票' {
    const slot = row.seatOrSlot ?? {};
    return slot.type === 'buy' ? '收票' : '出票';
  }

  static typeCode(row: TicketRow): 'buy' | 'sell' {
    const slot = row.seatOrSlot ?? {};
    return slot.type === 'buy' ? 'buy' : 'sell';
  }

  static price(row: TicketRow): string {
    return formatSlotPrice(row.seatOrSlot ?? {});
  }

  static quantity(row: TicketRow): string {
    const slot = row.seatOrSlot ?? {};
    return slot.quantity != null ? `${slot.quantity}张` : '';
  }

  static eventName(row: TicketRow, activityNames?: Map<string, string>): string {
    const slot = row.seatOrSlot ?? {};
    return (
      (typeof slot.displayEventName === 'string' && slot.displayEventName) ||
      activityNames?.get(row.activityId ?? '') ||
      row.activityId ||
      '未知活动'
    );
  }

  static seat(row: TicketRow): string {
    return row.skuCode ?? 'GA';
  }

  static seller(row: TicketRow): string {
    return row.userName?.trim() || row.userId || '用户';
  }

  static eventDate(row: TicketRow): string {
    const slot = row.seatOrSlot ?? {};
    return slot.eventDate ? ` · ${slot.eventDate}` : '';
  }

  static contact(row: TicketRow): string | undefined {
    const slot = row.seatOrSlot ?? {};
    return typeof slot.contact === 'string' && slot.contact.trim()
      ? slot.contact.trim()
      : undefined;
  }

  /** 列表行：`1. 【出票】活动 · GA · 2张 · ¥500 · 2026-06-01 · 用户` */
  static listLine(
    row: TicketRow,
    index: number,
    ctx: FormatRowContext,
  ): string {
    const parts = [
      `${index + 1}. 【${this.typeLabel(row)}】${this.eventName(row, ctx.activityNames)}`,
      this.seat(row),
    ];
    const qty = this.quantity(row);
    if (qty) parts.push(qty);
    parts.push(this.price(row));
    parts.push(this.eventDate(row).replace(/^ · /, '') || '');
    parts.push(this.seller(row));
    return parts.filter(p => p && p.length > 0).join(' · ');
  }

  /** 详情块（用于选中后的展示） */
  static detailBlock(
    row: TicketRow,
    ctx: {
      activityName?: string;
      contactHint?: string;
      cardEvent?: string;
    } = {},
  ): string {
    const slot = row.seatOrSlot ?? {};
    const type = this.typeLabel(row);
    const price =
      slot.price != null ? `¥${slot.price}` : '价格面议';
    const qty = this.quantity(row);
    const event =
      ctx.activityName ?? row.activityId ?? ctx.cardEvent ?? '未知活动';
    const seat = this.seat(row);
    const seller = this.seller(row);
    const eventDate = this.eventDate(row);
    const contact = this.contact(row) ?? ctx.contactHint;

    return [
      '已为你选中这条门票挂单 🎫',
      '',
      `【${type}】${event} · ${seat}${qty ? ` · ${qty}` : ''} · ${price}${eventDate}`,
      `发布者：${seller}`,
      contact ?? '如需联系卖家，可点击下方卡片查看详情。',
      '',
      '点击下方卡片可跳转到门票详情。',
    ]
      .filter(line => line !== null && line !== undefined)
      .join('\n');
  }
}
