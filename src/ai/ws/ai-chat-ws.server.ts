import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import type { Server as HttpServer } from 'http';
import { WebSocketServer } from 'ws';
import { AiChatWsHandler } from './ai-chat-ws.handler';
import { AI_CHAT_WS_PATH } from './ai-chat-ws.protocol';

@Injectable()
export class AiChatWsServer implements OnModuleDestroy {
  private readonly logger = new Logger(AiChatWsServer.name);
  private wss: WebSocketServer | null = null;

  constructor(private readonly handler: AiChatWsHandler) {}

  attach(httpServer: HttpServer): void {
    if (this.wss) {
      return;
    }

    this.wss = new WebSocketServer({ noServer: true });

    httpServer.on('upgrade', (request, socket, head) => {
      const url = request.url?.split('?')[0] ?? '';
      if (url !== AI_CHAT_WS_PATH) {
        return;
      }

      this.wss?.handleUpgrade(request, socket, head, ws => {
        this.wss?.emit('connection', ws, request);
      });
    });

    this.wss.on('connection', ws => {
      this.handler.handleConnection(ws);
    });

    this.logger.log(`✅ AI WebSocket: ws://localhost:<port>${AI_CHAT_WS_PATH}`);
  }

  onModuleDestroy(): void {
    this.wss?.close();
    this.wss = null;
  }
}
