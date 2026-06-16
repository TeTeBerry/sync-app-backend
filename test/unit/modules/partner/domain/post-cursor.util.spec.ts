import { Types } from 'mongoose';
import {
  clampActivityPostsLimit,
  decodePostCursor,
  encodePostCursor,
} from '@src/modules/partner/domain/post-cursor.util';
import type { PostRecord } from '@src/modules/partner/interfaces/post.repository.interface';

describe('post-cursor.util', () => {
  const postId = new Types.ObjectId();
  const createdAt = new Date('2026-06-01T12:00:00.000Z');
  const record = {
    _id: postId,
    createdAt,
  } as PostRecord;

  it('round-trips cursor encode/decode', () => {
    const cursor = encodePostCursor(record);
    const decoded = decodePostCursor(cursor);
    expect(decoded).not.toBeNull();
    expect(decoded!.id.toString()).toBe(postId.toString());
    expect(decoded!.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it('returns null for invalid cursor', () => {
    expect(decodePostCursor('not-a-cursor')).toBeNull();
    expect(decodePostCursor('')).toBeNull();
  });

  it('clamps activity posts page limit', () => {
    expect(clampActivityPostsLimit(undefined)).toBe(10);
    expect(clampActivityPostsLimit(0)).toBe(1);
    expect(clampActivityPostsLimit(5)).toBe(5);
    expect(clampActivityPostsLimit(99)).toBe(20);
  });
});
