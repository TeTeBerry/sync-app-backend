import { formatPriceLabel, formatSlotPrice } from '../utils/ticket-price.util';
import { composeReply } from '../utils/reply-text.util';
import {
  missingTicketDraftFields,
  type TicketDraft,
} from '../utils/ticket-draft.parser';
import type { TicketDraftMeta } from '../parser/slot-meta.types';
import type { TicketRow } from './ticket-row.types';

const MAX_MATCH_RESULTS = 8;

/**
 * 专门负责票务挂单的展示文本构建
 */
export class TicketListingPresenter {
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

  formatMatchRows(
    rows: TicketRow[],
    activityNames: Map<string, string>,
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
    const formatted = this.formatMatchRows(rows, activityNames);

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
}
