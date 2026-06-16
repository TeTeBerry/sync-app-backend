import { isCommentByPostOwner } from '@src/modules/partner/utils/comment-ownership.util';

describe('isCommentByPostOwner', () => {
  it('matches by userId even when display names collide', () => {
    expect(
      isCommentByPostOwner(
        { userId: 'user-b', authorName: '微信用户' },
        { userId: 'user-a', authorName: '微信用户' },
      ),
    ).toBe(false);
  });

  it('falls back to exact name when userId is missing on both sides', () => {
    expect(
      isCommentByPostOwner({ authorName: 'Mia' }, { authorName: 'Mia' }),
    ).toBe(true);
  });
});
