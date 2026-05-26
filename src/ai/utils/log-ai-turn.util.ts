import { Logger } from '@nestjs/common';

export interface AiTurnLogPayload {
  requestId: string;
  sessionId: string;
  intent?: string;
  intentSource?: string;
  ms_intent?: number;
  ms_profile?: number;
  ms_buddy?: number;
  ms_total?: number;
  event: string;
  [key: string]: unknown;
}

/** Structured JSON log for one AI chat turn — include requestId on every line. */
export function logAiTurn(logger: Logger, payload: AiTurnLogPayload): void {
  logger.log(JSON.stringify(payload));
}

export function createRequestId(existing?: string): string {
  const trimmed = existing?.trim();
  if (trimmed) return trimmed;
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}
