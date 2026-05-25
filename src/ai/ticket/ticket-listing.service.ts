import { Injectable } from '@nestjs/common';
import { resetToIdle, type ConversationState } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import {
  isListSelectionInput,
  parseListSelectionIndex,
} from '../utils/list-selection.util';
import {
  isTicketConfirmMessage,
  isTicketDraftComplete,
  isStillCreateListingIntent,
  missingTicketDraftFields,
  formatTicketActivityDisplayName,
  resolveTicketDraftContact,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import { formatPriceLabel, formatSlotPrice } from '../utils/ticket-price.util';
import { composeReply } from '../utils/reply-text.util';
import type { TicketDraftMeta } from '../parser/slot-meta.types';
import type { ReplyContext } from '../handlers/reply-handler.types';

export interface TicketListingProcessResult {
  text: string;
  ticketId?: string;
  nextState: ConversationState;
}

export interface TicketCreateContext {
  userId?: string;
  userName?: string;
  userPhone?: string;
  onTicketCreated?: (ticketId: string) => void;
}

const MAX_MATCH_RESULTS = 8;

function requireListingFields(draft: TicketDraft): {
  quantity: number;
  type: 'sell' | 'buy';
  skuCode: string;
  price: number;
  eventDate: string;
} | null {
  const { quantity, type, skuCode, price, eventDate } = draft;
  if (
    !quantity ||
    quantity <= 0 ||
    !type ||
    !skuCode?.trim() ||
    !price ||
    price <= 0 ||
    !eventDate?.trim()
  ) {
    return null;
  }
  return { quantity, type, skuCode, price, eventDate };
}

type TicketRow = {
  _id?: unknown;
  activityId?: string;
  userId?: string;
  userName?: string;
  skuCode?: string;
  seatOrSlot?: Record<string, unknown>;
};

@Injectable()
export class TicketListingService {
  constructor(
    private readonly ticketService: TicketService,
    private readonly activityService: ActivityService,
  ) {}

  async resolveActivityName(draft: TicketDraft): Promise<string> {
    const catalog =
      (draft.activityId
        ? await this.activityService.findByCode(draft.activityId)
        : null) ??
      (draft.activityKeyword
        ? await this.activityService.matchActivity(draft.activityKeyword)
        : null);

    return formatTicketActivityDisplayName(draft, catalog?.name);
  }

  buildKnownLines(
    draft: TicketDraft,
    activityName: string,
    draftMeta?: TicketDraftMeta,
  ): string[] {
    const lines: string[] = [];
    if (activityName && activityName !== '未知活动') {
      lines.push(`· 活动：${activityName}`);
    }
    if (draft.eventDate) {
      const auto =
        draftMeta?.eventDate?.source === 'knowledge' ||
        draftMeta?.eventDate?.source === 'catalog';
      lines.push(
        `· 演出日期：${draft.eventDate}${auto ? '（已从活动库自动匹配，可修改）' : ''}`,
      );
    }
    if (draft.skuCode) lines.push(`· 票种：${draft.skuCode}`);
    if (draft.quantity) lines.push(`· 数量：${draft.quantity} 张`);
    const priceLine = formatPriceLabel(draft);
    if (priceLine) lines.push(priceLine);
    if (draft.contact) {
      const fromAccount = draftMeta?.contact?.source === 'account';
      lines.push(
        `· 联系方式：${draft.contact}${fromAccount ? '（已使用账号手机，可修改）' : ''}`,
      );
    } else if (draftMeta?.contact?.source === 'account') {
      lines.push('· 联系方式：将使用账号绑定手机');
    }
    return lines;
  }

  buildRecap(
    draft: TicketDraft,
    activityName: string,
    draftMeta?: TicketDraftMeta,
  ): string {
    const typeLabel = draft.type === 'buy' ? '收票' : '出票';
    return composeReply([
      `请确认以下${typeLabel}信息：`,
      '',
      ...this.buildKnownLines(draft, activityName, draftMeta),
      '',
      '如需修改，可直接说「日期改成 2026-12-01」「单价800-1000」「手机联系」等；确认请回复「确认」。',
    ]);
  }

  buildCollectingReply(
    draft: TicketDraft,
    activityName: string,
    draftMeta?: TicketDraftMeta,
    fromImage = false,
    accountPhone?: string,
  ): string {
    const missing = missingTicketDraftFields(draft, accountPhone);
    const known = this.buildKnownLines(draft, activityName, draftMeta);
    const visionHint =
      draftMeta &&
      Object.values(draftMeta).some(meta => meta?.source === 'vision')
        ? '（部分字段已从图片识别，请核对）\n\n'
        : fromImage
          ? '（已收到图片，识别结果如下，请核对并补充）\n\n'
          : '';
    const contactHint = accountPhone?.trim()
      ? '（联系方式可省略，默认使用账号手机）'
      : '';

    if (!known.length) {
      if (fromImage) {
        return [
          '已收到门票图片，但未能自动识别出足够信息。',
          '',
          draft.type === 'buy'
            ? `请继续告诉我活动、日期、票种、数量、预算单价${contactHint}。`
            : `请继续告诉我活动、日期、票种、数量、单价${contactHint}。`,
        ].join('\n');
      }
      return draft.type === 'buy'
        ? `好的，请继续告诉我活动、日期、票种、数量、预算单价${contactHint}。`
        : `好的，请继续告诉我活动、日期、票种、数量、单价${contactHint}。`;
    }

    return composeReply([
      '已记录：',
      '',
      visionHint,
      ...known,
      '',
      `还缺：${missing.join('、')}。请继续补充。`,
    ]);
  }

  buildSuccessReply(draft: TicketDraft, activityName: string): string {
    const typeLabel = draft.type === 'buy' ? '收票' : '出票';
    return composeReply([
      `已为您发布${typeLabel}挂单 🎉`,
      '',
      ...this.buildKnownLines(draft, activityName),
      '',
      '可在「门票出/收」查看；点击聊天卡片也可跳转。',
    ]);
  }

  private formatMatchRows(
    rows: TicketRow[],
    activityNames: Map<string, string>,
    oppositeLabel: string,
  ): string {
    if (!rows.length) return '';

    return rows
      .slice(0, MAX_MATCH_RESULTS)
      .map((row, index) => {
        const slot = row.seatOrSlot ?? {};
        const type = slot.type === 'buy' ? '收票' : '出票';
        const price = formatSlotPrice(slot);
        const qty = slot.quantity != null ? `${slot.quantity}张` : '';
        const event =
          (typeof slot.displayEventName === 'string' && slot.displayEventName) ||
          activityNames.get(row.activityId ?? '') ||
          row.activityId ||
          '未知活动';
        const seller = row.userName?.trim() || row.userId || '用户';
        const seat = row.skuCode ?? 'GA';
        const eventDate = slot.eventDate ? ` · ${slot.eventDate}` : '';
        return `${index + 1}. 【${type}】${event} · ${seat}${qty ? ` · ${qty}` : ''} · ${price}${eventDate} · ${seller}`;
      })
      .join('\n');
  }

  buildMatchesReply(
    rows: TicketRow[],
    draft: TicketDraft,
    activityName: string,
    activityNames: Map<string, string>,
  ): string {
    const myLabel = draft.type === 'buy' ? '收票' : '出票';
    const formatted = this.formatMatchRows(rows, activityNames, draft.type === 'buy' ? '出票' : '收票');

    return [
      `在发布你的${myLabel}需求前，为你找到了 ${rows.length} 条可能匹配的${draft.type === 'buy' ? '出票' : '收票'}挂单 🎫`,
      '',
      formatted,
      '',
      '看中某条可以回复序号查看详情；若没有合适的，回复「确认」或「继续发布」仍可发布你的挂单。',
      '',
      '你的需求摘要：',
      ...this.buildKnownLines(draft, activityName),
    ].join('\n');
  }

  private ticketRowIds(rows: TicketRow[]): string[] {
    return rows
      .slice(0, MAX_MATCH_RESULTS)
      .map(row => (row._id != null ? String(row._id) : undefined))
      .filter((id): id is string => Boolean(id));
  }

  async createFromDraft(
    draft: TicketDraft,
    context: TicketCreateContext = {},
  ): Promise<{ text: string; ticketId?: string }> {
    const activityRef = draft.activityKeyword ?? draft.activityId;
    if (!activityRef?.trim()) {
      return {
        text: '挂单创建失败：缺少活动名称，请补充后再确认。',
      };
    }

    const contact = resolveTicketDraftContact(draft, context.userPhone);
    if (!contact) {
      return {
        text: '挂单创建失败：缺少联系方式，请补充手机号或微信后再确认。',
      };
    }

    const activity = await this.activityService.resolveOrCreateActivity({
      activityRef,
      activityId: draft.activityId,
      activityKeyword: draft.activityKeyword,
      eventDate: draft.eventDate,
    });

    if (!activity?.code) {
      return {
        text: `挂单创建失败：无法创建活动「${activityRef}」，请稍后重试。`,
      };
    }

    const fields = requireListingFields(draft);
    if (!fields) {
      return { text: '挂单创建失败：信息不完整，请补充后再确认。' };
    }

    const displayEventName = formatTicketActivityDisplayName(draft, activity.name);

    const ticket = await this.ticketService.createListing({
      activityId: activity.code,
      quantity: fields.quantity,
      type: fields.type,
      skuCode: fields.skuCode,
      price: fields.price,
      priceMax: draft.priceMax,
      eventDate: fields.eventDate,
      contact,
      displayEventName,
      userId: context.userId,
      userName: context.userName,
    });

    const ticketId = String(ticket._id ?? '');
    if (!ticketId) {
      return { text: '挂单写入失败，请稍后重试。' };
    }

    context.onTicketCreated?.(ticketId);

    const draftForReply: TicketDraft = { ...draft, contact };
    const activityName = displayEventName;
    return {
      text: this.buildSuccessReply(draftForReply, activityName),
      ticketId,
    };
  }

  private async buildMatchSelectReply(
    ctx: ReplyContext,
    selectionIndex: number,
  ): Promise<TicketListingProcessResult | null> {
    const listing = ctx.state.ticketListing;
    if (!listing) return null;
    const ids = listing.matchTicketIds ?? [];
    const ticketId = ids[selectionIndex - 1];
    if (!ticketId) {
      return {
        text: `只有 ${ids.length} 条匹配挂单，请输入 1-${ids.length} 之间的序号。`,
        nextState: ctx.state,
      };
    }

    const ticket = await this.ticketService.findById(ticketId);
    if (!ticket) {
      return {
        text: '该挂单已失效，请回复「确认」继续发布你的需求。',
        nextState: ctx.state,
      };
    }

    const activity = ticket.activityId
      ? await this.activityService.findByCode(ticket.activityId)
      : null;
    const slot = (ticket.seatOrSlot ?? {}) as Record<string, unknown>;
    const type = slot.type === 'buy' ? '收票' : '出票';
    const price = formatSlotPrice(slot);
    const qty = slot.quantity != null ? `${slot.quantity}张` : '';
    const event =
      (typeof slot.displayEventName === 'string' && slot.displayEventName) ||
      activity?.name ||
      ticket.activityId ||
      '未知活动';
    const seat = ticket.skuCode ?? 'GA';
    const seller = ticket.userName?.trim() || ticket.userId || '用户';
    const eventDate = slot.eventDate ? ` · ${slot.eventDate}` : '';
    const contact =
      typeof slot.contact === 'string' && slot.contact.trim()
        ? slot.contact.trim()
        : undefined;

    return {
      text: [
        '已为你选中这条匹配挂单 🎫',
        '',
        `【${type}】${event} · ${seat}${qty ? ` · ${qty}` : ''} · ${price}${eventDate}`,
        `发布者：${seller}`,
        contact ? `联系方式：${contact}` : '如需联系对方，可点击下方卡片查看详情。',
        '',
        '若没有合适的，回复「确认」或「继续发布」仍可发布你的挂单。',
      ]
        .filter(Boolean)
        .join('\n'),
      nextState: ctx.state,
    };
  }

  private async tryShowOppositeMatches(
    ctx: ReplyContext,
    draft: TicketDraft,
    activityName: string,
  ): Promise<TicketListingProcessResult | null> {
    const ticketListing = ctx.state.ticketListing;
    if (!ticketListing) return null;

    const activityRef = draft.activityKeyword ?? draft.activityId;
    if (!activityRef?.trim()) return null;

    const activity = await this.activityService.resolveOrCreateActivity({
      activityRef,
      activityId: draft.activityId,
      activityKeyword: draft.activityKeyword,
      eventDate: draft.eventDate,
    });
    if (!activity?.code) return null;

    const fields = requireListingFields(draft);
    if (!fields) return null;

    const matches = await this.ticketService.findOppositeMatches(
      {
        activityId: activity.code,
        quantity: fields.quantity,
        type: fields.type,
        skuCode: fields.skuCode,
        price: fields.price,
        priceMax: draft.priceMax,
        eventDate: fields.eventDate,
        contact: resolveTicketDraftContact(draft, ctx.userPhone),
      },
      ctx.userId,
    );

    if (!matches.length) return null;

    const activities = await this.activityService.findAll();
    const activityNames = new Map(
      activities.map(item => [item.code, item.name] as const),
    );

    const matchTicketIds = this.ticketRowIds(matches as TicketRow[]);

    return {
      text: this.buildMatchesReply(
        matches as TicketRow[],
        draft,
        activityName,
        activityNames,
      ),
      nextState: {
        ...ctx.state,
        ticketListing: {
          ...ticketListing,
          phase: 'browse_matches',
          matchTicketIds,
        },
      },
    };
  }

  async processListingFlow(ctx: ReplyContext): Promise<TicketListingProcessResult> {
    const listing = ctx.state.ticketListing;
    if (!listing) {
      return { text: '会话状态异常，请重新说出票或收票。', nextState: resetToIdle() };
    }
    const draft = listing.draft;
    const draftMeta = listing.draftMeta;
    const activityName = await this.resolveActivityName(draft);
    const accountPhone = ctx.userPhone;

    if (
      listing.phase === 'browse_matches' &&
      isListSelectionInput(ctx.input, MAX_MATCH_RESULTS)
    ) {
      const index = parseListSelectionIndex(ctx.input, MAX_MATCH_RESULTS);
      if (index) {
        const selected = await this.buildMatchSelectReply(ctx, index);
        if (selected) return selected;
      }
    }

    const wantsCreate =
      isTicketConfirmMessage(ctx.input) || isStillCreateListingIntent(ctx.input);

    if (wantsCreate) {
      if (!isTicketDraftComplete(draft, accountPhone)) {
        const missing = missingTicketDraftFields(draft, accountPhone);
        return {
          text: `还缺少以下信息，请补充后再确认：${missing.join('、')}。`,
          nextState: ctx.state,
        };
      }

      if (listing.phase === 'confirm') {
        const matchResult = await this.tryShowOppositeMatches(
          ctx,
          draft,
          activityName,
        );
        if (matchResult) return matchResult;
      }

      const result = await this.createFromDraft(draft, ctx);
      return {
        text: result.text,
        ticketId: result.ticketId,
        nextState: resetToIdle(),
      };
    }

    if (isTicketDraftComplete(draft, accountPhone)) {
      return {
        text: this.buildRecap(draft, activityName, draftMeta),
        nextState: {
          ...ctx.state,
          ticketListing: {
            ...listing,
            phase: 'confirm',
          },
        },
      };
    }

    return {
      text: this.buildCollectingReply(
        draft,
        activityName,
        draftMeta,
        Boolean(ctx.image?.trim()),
        accountPhone,
      ),
      nextState: ctx.state,
    };
  }
}
