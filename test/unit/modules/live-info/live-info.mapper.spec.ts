import { toLiveInfoFeedItemDto } from '../../../../src/modules/live-info/live-info.mapper';
import type { EventLiveUpdateDocument } from '../../../../src/database/schemas/event-live-update.schema';

function mockUpdate(likedByUserIds: string[]): EventLiveUpdateDocument {
  return {
    _id: 'upd-mock',
    activityLegacyId: 1,
    userId: 'author-1',
    authorName: '作者',
    ratings: [{ categoryId: 'entry_crowd', score: 3 }],
    expiresAt: new Date(Date.now() + 60_000),
    createdAt: new Date('2026-06-01T10:00:00.000Z'),
    likedByUserIds,
  } as unknown as EventLiveUpdateDocument;
}

describe('toLiveInfoFeedItemDto', () => {
  it('marks liked when viewer id is in likedByUserIds', () => {
    const dto = toLiveInfoFeedItemDto(
      mockUpdate(['viewer-a', 'viewer-b']),
      'viewer-b',
    );

    expect(dto.likes).toBe(2);
    expect(dto.liked).toBe(true);
  });

  it('marks not liked when viewer id is absent', () => {
    const dto = toLiveInfoFeedItemDto(mockUpdate(['viewer-a']), 'viewer-b');

    expect(dto.likes).toBe(1);
    expect(dto.liked).toBe(false);
  });

  it('returns liked false when viewer is unknown', () => {
    const dto = toLiveInfoFeedItemDto(mockUpdate(['viewer-a']));

    expect(dto.liked).toBe(false);
  });
});
