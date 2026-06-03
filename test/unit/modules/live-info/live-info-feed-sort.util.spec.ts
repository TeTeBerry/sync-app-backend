import {
  liveInfoUpdateSortScore,
  sortLiveInfoUpdatesByScore,
} from '@src/modules/live-info/domain/live-info-feed-sort.util';

describe('liveInfoUpdateSortScore', () => {
  it('ranks newer and more liked updates higher', () => {
    const older = {
      createdAt: new Date('2026-06-04T10:00:00Z'),
      likedByUserIds: [],
      remark: '',
    };
    const newer = {
      createdAt: new Date('2026-06-04T12:00:00Z'),
      likedByUserIds: ['u1'],
      remark: '安检排队约 20 分钟',
    };

    expect(liveInfoUpdateSortScore(newer)).toBeGreaterThan(
      liveInfoUpdateSortScore(older),
    );
  });

  it('sorts feed items stably by score descending', () => {
    const low = {
      createdAt: new Date('2026-06-04T08:00:00Z'),
      likedByUserIds: [],
      remark: '',
    };
    const mid = {
      createdAt: new Date('2026-06-04T09:00:00Z'),
      likedByUserIds: ['a'],
      remark: '',
    };
    const high = {
      createdAt: new Date('2026-06-04T11:00:00Z'),
      likedByUserIds: ['a', 'b'],
      remark: '厕所人少',
    };

    const sorted = sortLiveInfoUpdatesByScore([low, high, mid]);
    expect(sorted).toEqual([high, mid, low]);
  });
});
