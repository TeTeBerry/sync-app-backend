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
    if (draft.price) {
      const label = draft.type === 'buy' ? '预算单价' : '单价';
      lines.push(`· ${label}：¥${draft.price}/张`);
    }
    if (draft.contact) {
      const fromAccount = draftMeta?.contact?.source === 'account';
      lines.push(
        `· 联系方式：${draft.contact}${fromAccount ? '（已使用账号手机，可修改）' : ''}`,
      );
    }
    return lines;
  }

  buildRecap(
    draft: TicketDraft,
    activityName: string,
    draftMeta?: TicketDraftMeta,
  ): string {
    const typeLabel = draft.type === 'buy' ? '收票' : '出票';
    return [
      `请确认以下${typeLabel}信息：`,
      '',
      ...this.buildKnownLines(draft, activityName, draftMeta),
      '',
      '如需修改，可直接说「日期改成 2026-12-01」「单价800」「手机联系」等；确认请回复「确认」。',
    ].join('\n');
  }

  buildCollectingReply(
    draft: TicketDraft,
    activityName: string,
    draftMeta?: TicketDraftMeta,
    fromImage = false,
  ): string {
    const missing = missingTicketDraftFields(draft);
    const known = this.buildKnownLines(draft, activityName, draftMeta);
    const visionHint =
      draftMeta &&
      Object.values(draftMeta).some(meta => meta?.source === 'vision')
        ? '（部分字段已从图片识别，请核对）\n\n'
        : fromImage
          ? '（已收到图片，识别结果如下，请核对并补充）\n\n'
          : '';

    if (!known.length) {
      if (fromImage) {
        return [
          '已收到门票图片，但未能自动识别出足够信息。',
          '',
          draft.type === 'buy'
            ? '请继续告诉我活动、日期、票种、数量、预算单价和联系方式。'
            : '请继续告诉我活动、日期、票种、数量、单价和联系方式。',
        ].join('\n');
      }
      return draft.type === 'buy'
        ? '好的，请继续告诉我活动、日期、票种、数量、预算单价和联系方式。'
        : '好的，请继续告诉我活动、日期、票种、数量、单价和联系方式。';
    }

    return [
      '已记录：',
      '',
      visionHint,
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
    const activityRef = draft.activityKeyword ?? draft.activityId;
    if (!activityRef?.trim()) {
      return {
        text: '挂单创建失败：缺少活动名称，请补充后再确认。',
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
    const listing = ctx.state.ticketListing!;
    const draft = listing.draft;
    const draftMeta = listing.draftMeta;
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
      ),
      nextState: ctx.state,
    };
  }
}
