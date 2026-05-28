import { Injectable, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { WebSocket } from 'ws';
import { AiService } from '../ai.service';
import { ChatRequestDto } from '../presentation/chat-request.dto';
import type { AiStreamEvent } from '../presentation/ai-stream-event.view';
import { createRequestId } from '../utils/log-ai-turn.util';
import type {
  AiChatWsClientMessage,
  AiChatWsServerMessage,
  AiChatWsSimpleClientMessage,
} from './ai-chat-ws.protocol';

function formatValidationErrors(dto: ChatRequestDto): string {
  const errors = validateSync(dto, { whitelist: true });
  if (!errors.length) return '请求参数无效';
  const messages: string[] = [];
  for (const error of errors) {
    if (error.constraints) {
      messages.push(...Object.values(error.constraints));
    }
  }
  return messages[0] ?? '请求参数无效';
}

function isConnectMessage(
  parsed: AiChatWsClientMessage,
): parsed is Extract<AiChatWsClientMessage, { type: 'connect' }> {
  return parsed.type === 'connect';
}

function isSendMessage(
  parsed: AiChatWsClientMessage,
): parsed is Extract<AiChatWsClientMessage, { type: 'send' }> {
  return parsed.type === 'send';
}

function resolveSendPayload(
  parsed: AiChatWsClientMessage,
): Extract<AiChatWsClientMessage, { type: 'send' }> | null {
  if (isSendMessage(parsed)) {
    return parsed;
  }

  const simple = parsed as AiChatWsSimpleClientMessage;
  const messages = Array.isArray(simple.messages)
    ? simple.messages
    : typeof simple.message === 'string'
      ? [{ role: 'user', content: simple.message }]
      : null;

  if (!messages?.length) {
    return null;
  }

  return {
    type: 'send',
    messages,
    sessionId: simple.sessionId,
    userId: simple.userId,
    userName: simple.userName,
    userPhone: simple.userPhone,
    activityLegacyId: simple.activityLegacyId,
    image: simple.image,
    images: simple.images,
    requestId: simple.requestId,
  };
}

@Injectable()
export class AiChatWsHandler {
  private readonly logger = new Logger(AiChatWsHandler.name);
  private static connectionSeq = 0;

  constructor(private readonly aiService: AiService) {}

  private isDevLog(): boolean {
    return process.env.NODE_ENV !== 'production';
  }

  private devLog(
    connectionId: number,
    message: string,
    meta?: Record<string, unknown>,
  ): void {
    if (!this.isDevLog()) return;
    const suffix = meta ? ` ${JSON.stringify(meta)}` : '';
    this.logger.log(`[conn#${connectionId}] ${message}${suffix}`);
  }

  handleConnection(socket: WebSocket): void {
    const connectionId = ++AiChatWsHandler.connectionSeq;
    let busy = false;
    let sessionId: string | undefined;
    let activityLegacyId: number | undefined;
    let messageChain = Promise.resolve();

    this.devLog(connectionId, 'connected', {
      readyState: socket.readyState,
    });

    const send = (message: AiChatWsServerMessage) => {
      if (socket.readyState !== socket.OPEN) return;
      const wire = AiChatWsHandler.toServerMessage(message);
      if (this.isDevLog()) {
        const preview =
          wire.type === 'delta'
            ? {
                type: wire.type,
                contentLen: wire.content.length,
              }
            : wire;
        this.devLog(connectionId, 'send', preview as Record<string, unknown>);
      }
      socket.send(JSON.stringify(wire));
    };

    const handleMessage = async (
      raw: Buffer | ArrayBuffer | Buffer[] | string,
    ): Promise<void> => {
      let parsed: AiChatWsClientMessage;
      const text =
        typeof raw === 'string'
          ? raw
          : Buffer.isBuffer(raw)
            ? raw.toString('utf8')
            : Array.isArray(raw)
              ? Buffer.concat(raw).toString('utf8')
              : String(raw);
      try {
        parsed = JSON.parse(text) as AiChatWsClientMessage;
      } catch {
        this.devLog(connectionId, 'invalid JSON from client', {
          preview: text.slice(0, 120),
        });
        send({ type: 'error', message: '无效的消息格式' });
        return;
      }

      this.devLog(connectionId, 'message received', {
        type: parsed.type ?? '(simple)',
        busy,
      });

      if (isConnectMessage(parsed)) {
        sessionId = parsed.sessionId?.trim() || sessionId;
        activityLegacyId = parsed.activityLegacyId ?? activityLegacyId;
        send({
          type: 'connected',
          sessionId,
          activityLegacyId,
        });
        return;
      }

      const sendPayload = resolveSendPayload(parsed);
      if (!sendPayload) {
        send({ type: 'error', message: 'message 或 messages 不能为空' });
        return;
      }

      if (busy) {
        send({ type: 'error', message: '上一条消息仍在处理中，请稍候' });
        return;
      }

      const dto = plainToInstance(ChatRequestDto, {
        messages: sendPayload.messages,
        sessionId: sendPayload.sessionId?.trim() || sessionId,
        userId: sendPayload.userId,
        userName: sendPayload.userName,
        userPhone: sendPayload.userPhone,
        activityLegacyId: sendPayload.activityLegacyId ?? activityLegacyId,
        image: sendPayload.image,
        images: sendPayload.images,
      });

      const validationErrors = validateSync(dto, { whitelist: true });
      if (validationErrors.length) {
        send({ type: 'error', message: formatValidationErrors(dto) });
        return;
      }

      if (dto.sessionId?.trim()) {
        sessionId = dto.sessionId.trim();
      }
      if (dto.activityLegacyId != null) {
        activityLegacyId = dto.activityLegacyId;
      }

      busy = true;
      const requestId = createRequestId(sendPayload.requestId);

      try {
        this.devLog(connectionId, 'streamChat start', {
          requestId,
          sessionId: dto.sessionId,
        });
        for await (const event of this.aiService.streamChat(dto, { requestId })) {
          send(event);
          if (event.type === 'error') {
            break;
          }
        }
        this.devLog(connectionId, 'streamChat finished');
      } catch (error) {
        this.logger.warn(
          `[conn#${connectionId}] WS chat error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        send({
          type: 'error',
          message:
            error instanceof Error ? error.message : 'AI 对话失败，请稍后重试',
        });
      } finally {
        busy = false;
      }
    };

    socket.on('message', (raw: Buffer | ArrayBuffer | Buffer[] | string) => {
      messageChain = messageChain
        .then(() => handleMessage(raw))
        .catch(error => {
          this.logger.warn(
            `WS message handler failed: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          send({ type: 'error', message: 'AI 对话失败，请稍后重试' });
        });
    });

    socket.on('close', (code, reason) => {
      this.devLog(connectionId, 'socket closed', {
        code,
        reason: reason?.toString(),
      });
    });

    socket.on('error', error => {
      this.logger.warn(
        `[conn#${connectionId}] WS socket error: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    });
  }

  static toServerMessage(event: AiChatWsServerMessage): AiChatWsServerMessage {
    if (event.type === 'delta') {
      return {
        chunk: event.content,
        type: 'delta',
        content: event.content,
      };
    }
    return event;
  }
}
