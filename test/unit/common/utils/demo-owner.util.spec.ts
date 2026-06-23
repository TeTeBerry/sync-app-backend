import {
  buildOwnerMongoFilter,
  isResourceOwnedByClient,
} from '@src/common/utils/demo-owner.util';

describe('demo-owner.util', () => {
  describe('buildOwnerMongoFilter', () => {
    it('filters authenticated users by userId only', () => {
      expect(buildOwnerMongoFilter('wx_openid-1', '微信用户')).toEqual({
        userId: 'wx_openid-1',
      });
    });

    it('falls back to authorName when userId is absent', () => {
      expect(buildOwnerMongoFilter(undefined, 'Zara Chen')).toEqual({
        $or: [
          { authorName: 'Zara Chen' },
          { authorName: { $regex: '^Zara', $options: 'i' } },
        ],
      });
    });

    it('returns impossible match when no owner fields are present', () => {
      expect(buildOwnerMongoFilter()).toEqual({ _id: null });
    });
  });

  describe('isResourceOwnedByClient', () => {
    it('matches by userId before authorName', () => {
      expect(
        isResourceOwnedByClient(
          { userId: 'wx_a', authorName: '微信用户' },
          'wx_a',
          '微信用户',
        ),
      ).toBe(true);
    });

    it('does not match another user with the same default nickname', () => {
      expect(
        isResourceOwnedByClient(
          { userId: 'wx_a', authorName: '微信用户' },
          'wx_b',
          '微信用户',
        ),
      ).toBe(false);
    });
  });
});
