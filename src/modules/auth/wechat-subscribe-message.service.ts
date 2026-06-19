import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WechatAccessTokenService } from './wechat-access-token.service';

export type PostEngagementSubscribePayload = {
  openid: string;
  templateKey: 'comment' | 'commentReply';
  activityLegacyId?: number;
  postId: string;
  actorName: string;
  preview: string;
  activityName?: string;
  /** Defaults to send time when template includes a time field. */
  occurredAt?: Date;
};

interface WechatSubscribeSendResponse {
  errcode?: number;
  errmsg?: string;
}

@Injectable()
export class WechatSubscribeMessageService {
  private readonly logger = new Logger(WechatSubscribeMessageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly accessToken: WechatAccessTokenService,
  ) {}

  isEnabled(): boolean {
    return Boolean(
      this.resolveTemplateId('comment') ||
      this.resolveTemplateId('commentReply'),
    );
  }

  async sendPostEngagementNotice(
    payload: PostEngagementSubscribePayload,
  ): Promise<void> {
    const openid = payload.openid?.trim();
    const postId = payload.postId?.trim();
    if (!openid || !postId) return;

    const templateId = this.resolveTemplateId(payload.templateKey);
    if (!templateId) return;

    if (!this.accessToken.isConfigured()) return;

    let accessToken: string;
    try {
      accessToken = await this.accessToken.getAccessToken();
    } catch (error) {
      this.logger.warn(
        `Subscribe message skipped (token): ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      return;
    }

    const page = this.buildEventDetailPage(payload.activityLegacyId, postId);
    const body = {
      touser: openid,
      template_id: templateId,
      page,
      miniprogram_state: 'formal' as const,
      lang: 'zh_CN' as const,
      data: this.buildTemplateData(payload),
    };

    try {
      const res = await fetch(
        `https://api.weixin.qq.com/cgi-bin/message/subscribe/send?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as WechatSubscribeSendResponse;
      if (json.errcode && json.errcode !== 0) {
        this.logger.warn(
          `Subscribe message rejected (${json.errcode}): ${json.errmsg ?? 'unknown'}`,
        );
      }
    } catch (error) {
      this.logger.warn(
        `Subscribe message send failed: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private resolveTemplateId(key: 'comment' | 'commentReply'): string {
    if (key === 'commentReply') {
      return (
        this.config
          .get<string>('auth.wechatMini.subscribeCommentReplyTemplateId')
          ?.trim() ||
        this.config
          .get<string>('auth.wechatMini.subscribeCommentTemplateId')
          ?.trim() ||
        ''
      );
    }
    return (
      this.config
        .get<string>('auth.wechatMini.subscribeCommentTemplateId')
        ?.trim() || ''
    );
  }

  private buildEventDetailPage(
    activityLegacyId: number | undefined,
    postId: string,
  ): string {
    const legacyId = activityLegacyId ?? 0;
    const params = new URLSearchParams({
      id: String(legacyId),
      activityLegacyId: String(legacyId),
      postId,
      focusPosts: '1',
      openComments: '1',
    });
    return `packageEvent/pages/event-detail/index?${params.toString()}`;
  }

  buildTemplateData(
    payload: PostEngagementSubscribePayload,
  ): Record<string, { value: string }> {
    const fields = this.resolveTemplateFields(payload.templateKey);

    const actor = this.clampField(payload.actorName || '有人', 20);
    const preview = payload.preview?.trim() || '…';
    const previewValue = this.clampField(`${actor}：${preview}`, 20);

    const data: Record<string, { value: string }> = {
      [fields.preview]: { value: previewValue },
    };

    if (fields.time) {
      data[fields.time] = {
        value: this.formatSubscribeTime(payload.occurredAt ?? new Date()),
      };
    }

    return data;
  }

  private resolveTemplateFields(templateKey: 'comment' | 'commentReply'): {
    preview: string;
    time: string;
  } {
    if (templateKey === 'commentReply') {
      return {
        preview:
          this.fieldKey('auth.wechatMini.subscribeReplyFieldPreview') ||
          this.fieldKey('auth.wechatMini.subscribeFieldPreview') ||
          'thing2',
        time:
          this.fieldKey('auth.wechatMini.subscribeReplyFieldTime') ||
          this.fieldKey('auth.wechatMini.subscribeFieldTime'),
      };
    }

    return {
      preview:
        this.fieldKey('auth.wechatMini.subscribeFieldPreview') || 'thing2',
      time: this.fieldKey('auth.wechatMini.subscribeFieldTime'),
    };
  }

  private fieldKey(configKey: string): string {
    const raw = this.config.get<string>(configKey)?.trim() ?? '';
    if (!raw || raw === '-' || raw.toLowerCase() === 'none') {
      return '';
    }
    return raw;
  }

  formatSubscribeTime(date: Date): string {
    const pad = (value: number) => String(value).padStart(2, '0');
    return `${date.getFullYear()}年${pad(date.getMonth() + 1)}月${pad(date.getDate())}日 ${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  private clampField(value: string, maxLen: number): string {
    const normalized = value.replace(/\s+/g, ' ').trim();
    if (!normalized) return '…';
    if (normalized.length <= maxLen) return normalized;
    return `${normalized.slice(0, maxLen - 1)}…`;
  }
}
