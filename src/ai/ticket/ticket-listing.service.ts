import { Injectable } from '@nestjs/common';
import { resetToIdle, type ConversationState } from '../conversation';
import { ActivityService } from '../../modules/activity/activity.service';
import { TicketService } from '../../modules/ticket/ticket.service';
import {
  isTicketConfirmMessage,
  isTicketDraftComplete,
  missingTicketDraftFields,
  formatTicketActivityDisplayName,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import type { ReplyContext } from '../handlers/reply-handler.types';

export interface TicketListingProcessResult {
  text: string;
  ticketId?: string;
  nextState: ConversationState;
}

export interface TicketCreateContext {
  userId?: string;
  userName?: string;
  onTicketCreated?: (ticketId: string) => void;
}

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

  buildKnownLines(draft: TicketDraft, activityName: string): string[] {
    const lines: string[] = [];
    if (activityName) lines.push(`· 活动：${activityName}`);
    if (draft.eventDate) lines.push(`· 演出日期：${draft.eventDate}`);
    if (draft.skuCode) lines.push(`· 票种：${draft.skuCode}`);
    if (draft.quantity) lines.push(`· 数量：${draft.quantity} 张`);
    if (draft.price) {
      const label = draft.type === 'buy' ? '预算单价' : '单价';
      lines.push(`· ${label}：¥${draft.price}/张`);
    }
    if (draft.contact) lines.push(`· 联系方式：${draft.contact}`);
    return lines;
  }

  buildRecap(draft: TicketDraft, activityName: string): string {
    const typeLabel = draft.type === 'buy' ? '收票' : '出票';
    return [
      `请确认以下${typeLabel}信息：`,
      '',
      ...this.buildKnownLines(draft, activityName),
      '',
      '信息无误请回复「确认」，我将立即发布到「门票出/收」。',
    ].join('\n');
  }

  buildCollectingReply(draft: TicketDraft, activityName: string): string {
    const missing = missingTicketDraftFields(draft);
    const known = this.buildKnownLines(draft, activityName);

    if (!known.length) {
      return draft.type === 'buy'
        ? '好的，请继续告诉我活动、日期、票种、数量、预算单价和联系方式。'
        : '好的，请继续告诉我活动、日期、票种、数量、单价和联系方式。';
    }

    return [
      '已记录：',
      '',
      ...known,
      '',
      `还缺：${missing.join('、')}。请继续补充。`,
    ].join('\n');
  }

  buildSuccessReply(draft: TicketDraft, activityName: string): string {
    const typeLabel = draft.type === 'buy' ? '收票' : '出票';
    return [
      `已为您发布${typeLabel}挂单 🎉`,
      '',
      ...this.buildKnownLines(draft, activityName),
      '',
      '可在「门票出/收」查看；点击聊天卡片也可跳转。',
    ].join('\n');
  }

  async createFromDraft(
    draft: TicketDraft,
    context: TicketCreateContext = {},
  ): Promise<{ text: string; ticketId?: string }> {
    const activityRef = draft.activityKeyword ?? draft.activityId!;
    const activity =
      (await this.activityService.matchActivity(activityRef)) ??
      (draft.activityId
        ? await this.activityService.findByCode(draft.activityId)
        : null);

    if (!activity?.code) {
      return {
        text: `挂单创建失败：未找到活动「${activityRef}」，请提供更准确的活动名称。`,
      };
    }

    const displayEventName = formatTicketActivityDisplayName(draft, activity.name);

    const ticket = await this.ticketService.createListing({
      activityId: activity.code,
      quantity: draft.quantity!,
      type: draft.type!,
      skuCode: draft.skuCode!,
      price: draft.price!,
      eventDate: draft.eventDate!,
      contact: draft.contact!,
      displayEventName,
      userId: context.userId,
      userName: context.userName,
    });

    const ticketId = String(ticket._id ?? '');
    if (!ticketId) {
      return { text: '挂单写入失败，请稍后重试。' };
    }

    context.onTicketCreated?.(ticketId);

    const activityName = displayEventName;
    return {
      text: this.buildSuccessReply(draft, activityName),
      ticketId,
    };
  }

  async processListingFlow(ctx: ReplyContext): Promise<TicketListingProcessResult> {
    const draft = ctx.state.ticketListing!.draft;
    const activityName = await this.resolveActivityName(draft);

    if (isTicketConfirmMessage(ctx.input)) {
      if (!isTicketDraftComplete(draft)) {
        const missing = missingTicketDraftFields(draft);
        return {
          text: `还缺少以下信息，请补充后再确认：${missing.join('、')}。`,
          nextState: ctx.state,
        };
      }

      const result = await this.createFromDraft(draft, ctx);
      return {
        text: result.text,
        ticketId: result.ticketId,
        nextState: resetToIdle(),
      };
    }

    if (isTicketDraftComplete(draft)) {
      return {
        text: this.buildRecap(draft, activityName),
        nextState: ctx.state,
      };
    }

    return {
      text: this.buildCollectingReply(draft, activityName),
      nextState: ctx.state,
    };
  }
}
