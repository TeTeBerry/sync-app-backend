import { Types } from 'mongoose';
import {
  clampCommentPageLimit,
  decodeCommentCursor,
  encodeCommentCursor,
} from '@src/modules/partner/domain/comment-cursor.util';

describe('comment-cursor.util', () => {
  it('round-trips cursor encoding', () => {
    const id = new Types.ObjectId();
    const createdAt = new Date('2025-06-01T12:00:00.000Z');
    const cursor = encodeCommentCursor({ _id: id, createdAt });
    const decoded = decodeCommentCursor(cursor);

    expect(decoded?.id.toString()).toBe(id.toString());
    expect(decoded?.createdAt.toISOString()).toBe(createdAt.toISOString());
  });

  it('returns null for invalid cursor', () => {
    expect(decodeCommentCursor('not-a-cursor')).toBeNull();
  });

  it('clamps page limit', () => {
    expect(clampCommentPageLimit(undefined)).toBe(20);
    expect(clampCommentPageLimit(100)).toBe(50);
    expect(clampCommentPageLimit(3)).toBe(3);
  });
});
