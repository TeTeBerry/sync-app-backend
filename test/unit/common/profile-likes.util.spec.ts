import { sumProfilePostLikes } from '@src/common/utils/profile-likes.util';

describe('sumProfilePostLikes', () => {
  it('sums like counters on owner posts', () => {
    expect(
      sumProfilePostLikes([
        { likes: 10 },
        { likes: 3 },
        { likes: 0 },
      ]),
    ).toBe(13);
  });
});
