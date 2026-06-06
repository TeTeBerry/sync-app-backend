import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MediaSecurityCheckService } from './media-security-check.service';

type WechatMediaCheckEvent = {
  Event?: string;
  trace_id?: string;
  traceId?: string;
  errcode?: number;
  result?: { suggest?: string; label?: number };
};

@Injectable()
export class WechatMessageService {
  private readonly logger = new Logger(WechatMessageService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly mediaChecks: MediaSecurityCheckService,
  ) {}

  verifySignature(
    signature: string | undefined,
    timestamp: string | undefined,
    nonce: string | undefined,
  ): boolean {
    const token = this.config
      .get<string>('auth.wechatMini.messageToken', '')
      .trim();
    if (!token || !signature || !timestamp || !nonce) {
      return false;
    }
    const digest = createHash('sha1')
      .update([token, timestamp, nonce].sort().join(''))
      .digest('hex');
    return digest === signature;
  }

  async handlePayload(raw: unknown): Promise<void> {
    const events = this.extractMediaCheckEvents(raw);
    for (const event of events) {
      await this.handleMediaCheckEvent(event);
    }
  }

  private extractMediaCheckEvents(raw: unknown): WechatMediaCheckEvent[] {
    if (!raw) {
      return [];
    }
    if (typeof raw === 'string') {
      return this.extractMediaCheckEventsFromText(raw);
    }
    if (Array.isArray(raw)) {
      return raw.flatMap((item) => this.extractMediaCheckEvents(item));
    }
    if (typeof raw === 'object') {
      const obj = raw as Record<string, unknown>;
      if (obj.Event === 'wxa_media_check' || obj.event === 'wxa_media_check') {
        return [obj as WechatMediaCheckEvent];
      }
      const nested = obj.xml ?? obj.XML ?? obj.data ?? obj.Data;
      if (nested) {
        return this.extractMediaCheckEvents(nested);
      }
    }
    return [];
  }

  private extractMediaCheckEventsFromText(
    text: string,
  ): WechatMediaCheckEvent[] {
    if (!/wxa_media_check/i.test(text)) {
      return [];
    }
    try {
      const parsed = JSON.parse(text) as WechatMediaCheckEvent;
      if (parsed.Event === 'wxa_media_check') {
        return [parsed];
      }
    } catch {
      // fall through to XML-ish extraction
    }
    const traceId =
      text.match(/<trace_id><!\[CDATA\[(.+?)\]\]><\/trace_id>/i)?.[1] ??
      text.match(/"trace_id"\s*:\s*"([^"]+)"/i)?.[1];
    if (!traceId) {
      return [];
    }
    const suggest =
      text.match(/<suggest><!\[CDATA\[(.+?)\]\]><\/suggest>/i)?.[1] ??
      text.match(/"suggest"\s*:\s*"([^"]+)"/i)?.[1];
    const errcodeRaw =
      text.match(/<errcode><!\[CDATA\[(.+?)\]\]><\/errcode>/i)?.[1] ??
      text.match(/"errcode"\s*:\s*(-?\d+)/i)?.[1];
    return [
      {
        Event: 'wxa_media_check',
        trace_id: traceId,
        errcode: errcodeRaw ? Number(errcodeRaw) : undefined,
        result: suggest ? { suggest } : undefined,
      },
    ];
  }

  private async handleMediaCheckEvent(
    event: WechatMediaCheckEvent,
  ): Promise<void> {
    const traceId = (event.trace_id ?? event.traceId)?.trim();
    if (!traceId) {
      return;
    }

    const wechatResult = event as Record<string, unknown>;
    if (event.errcode !== undefined && event.errcode !== 0) {
      const record = await this.mediaChecks.markRejected(traceId, wechatResult);
      if (record) {
        this.logger.warn(
          `media_check rejected trace=${traceId} errcode=${event.errcode}`,
        );
      }
      return;
    }

    const suggest = event.result?.suggest?.toLowerCase();
    if (suggest === 'pass' || suggest === 'ok') {
      await this.mediaChecks.markApproved(traceId, wechatResult);
      return;
    }

    if (suggest === 'risky' || suggest === 'review') {
      await this.mediaChecks.markRejected(traceId, wechatResult);
      return;
    }

    this.logger.warn(
      `media_check unknown suggest trace=${traceId} suggest=${suggest ?? 'n/a'}`,
    );
  }
}
