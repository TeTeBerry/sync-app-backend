import { liveInfoUpdateFingerprint } from '../../../../src/modules/live-info/utils/live-info-update-fingerprint.util';

describe('liveInfoUpdateFingerprint', () => {
  it('is stable regardless of ratings order', () => {
    const a = liveInfoUpdateFingerprint({
      ratings: [
        { categoryId: 'toilet_queue', score: 3 },
        { categoryId: 'entry_crowd', score: 4 },
      ],
      remark: '北门排队',
    });
    const b = liveInfoUpdateFingerprint({
      ratings: [
        { categoryId: 'entry_crowd', score: 4 },
        { categoryId: 'toilet_queue', score: 3 },
      ],
      remark: '北门排队',
    });
    expect(a).toBe(b);
  });

  it('changes when remark or scores differ', () => {
    const base = liveInfoUpdateFingerprint({
      ratings: [{ categoryId: 'sound_level', score: 5 }],
    });
    const other = liveInfoUpdateFingerprint({
      ratings: [{ categoryId: 'sound_level', score: 4 }],
      remark: '很响',
    });
    expect(base).not.toBe(other);
  });
});
