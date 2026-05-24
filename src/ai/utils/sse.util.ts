import { Response } from 'express';
import { AiStreamEvent } from '../dto/chat.dto';

export function initSseResponse(res: Response): void {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();
}

export function writeSseEvent(res: Response, event: AiStreamEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
