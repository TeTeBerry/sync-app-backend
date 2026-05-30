import { Types } from 'mongoose';
import type { PostRecord } from '../interfaces/post.repository.interface';

export type PostPageCursor = {
  createdAt: Date;
  id: Types.ObjectId;
};

function toBase64Url(value: string): string {
  return Buffer.from(value, 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function fromBase64Url(cursor: string): string {
  const normalized = cursor.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (normalized.length % 4)) % 4;
  const padded = normalized + '='.repeat(padLen);
  return Buffer.from(padded, 'base64').toString('utf8');
}

export function encodePostCursor(post: PostRecord): string {
  const createdAt =
    post.createdAt instanceof Date
      ? post.createdAt
      : new Date(String(post.createdAt ?? 0));
  const payload = {
    c: createdAt.toISOString(),
    i: String(post._id),
  };
  return toBase64Url(JSON.stringify(payload));
}

export function decodePostCursor(cursor: string): PostPageCursor | null {
  try {
    const raw = fromBase64Url(cursor);
    const parsed = JSON.parse(raw) as { c?: string; i?: string };
    if (!parsed.c || !parsed.i || !Types.ObjectId.isValid(parsed.i)) {
      return null;
    }
    const createdAt = new Date(parsed.c);
    if (Number.isNaN(createdAt.getTime())) return null;
    return { createdAt, id: new Types.ObjectId(parsed.i) };
  } catch {
    return null;
  }
}

export function clampActivityPostsLimit(limit?: number): number {
  if (limit == null || Number.isNaN(limit)) return 10;
  return Math.min(Math.max(Math.floor(limit), 1), 20);
}
