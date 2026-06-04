import type { IncomingMessage } from 'http';
import type { Request } from 'express';

function firstForwardedIp(
  value: string | string[] | undefined,
): string | undefined {
  if (!value) return undefined;
  const raw = Array.isArray(value) ? value[0] : value;
  const first = raw?.split(',')[0]?.trim();
  return first || undefined;
}

/** Best-effort client IP for WeChat `getuserriskrank` (required field). */
export function resolveClientIpFromRequest(
  req: Request | IncomingMessage,
): string {
  const headers = req.headers as Record<string, string | string[] | undefined>;
  const forwarded =
    firstForwardedIp(headers['x-forwarded-for']) ??
    firstForwardedIp(headers['x-real-ip']);
  if (forwarded) return forwarded;

  const expressReq = req as Request;
  if (expressReq.ip?.trim()) return expressReq.ip.trim();

  const socket = (req as IncomingMessage).socket;
  const remote = socket?.remoteAddress?.trim();
  if (remote) {
    return remote.replace(/^::ffff:/, '');
  }

  return '127.0.0.1';
}
