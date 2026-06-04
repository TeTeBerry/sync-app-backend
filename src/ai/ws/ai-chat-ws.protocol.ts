import type { AiStreamEvent } from '../../shared/chat';

/** Client → server (simple Taro payload) */
export type AiChatWsSimpleClientMessage = {
  message?: string;
  messages?: unknown[];
  sessionId?: string;
  activityLegacyId?: number;
  userId?: string;
  userName?: string;
  userPhone?: string;
  /** Upload URL from POST /api/uploads/images (WeChat img_sec_check at upload). */
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
  | {
      type: 'connected';
      sessionId?: string;
      activityLegacyId?: number;
      /** Present when upgrade carried a valid Bearer JWT. */
      auth?: 'jwt' | 'demo';
    }
  | { type: 'error'; message: string };

export const AI_CHAT_WS_PATH = '/api/ai/chat/ws';
