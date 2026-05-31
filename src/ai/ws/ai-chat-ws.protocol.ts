import type { AiStreamEvent } from '../presentation/ai-stream-event.view';

/** Client → server (simple Taro payload) */
export type AiChatWsSimpleClientMessage = {
  message?: string;
  messages?: unknown[];
  sessionId?: string;
  activityLegacyId?: number;
  userId?: string;
  userName?: string;
  userPhone?: string;
  /** Upload URL from POST /api/uploads/images, or legacy data URL */
  image?: string;
  images?: string[];
  requestId?: string;
};

/** Client → server (typed, optional handshake) */
export type AiChatWsClientMessage =
  | {
      type: 'connect';
      sessionId?: string;
      activityLegacyId?: number;
    }
  | {
      type: 'send';
      message?: string;
      messages?: unknown[];
      sessionId?: string;
      userId?: string;
      userName?: string;
      userPhone?: string;
      activityLegacyId?: number;
      image?: string;
      images?: string[];
      requestId?: string;
    }
  | (AiChatWsSimpleClientMessage & { type?: undefined });

/** Server → client */
export type AiChatWsServerMessage =
  | AiStreamEvent
  | { chunk: string; type: 'delta'; content: string }
  | { type: 'connected'; sessionId?: string; activityLegacyId?: number }
  | { type: 'error'; message: string };

export const AI_CHAT_WS_PATH = '/api/ai/chat/ws';
