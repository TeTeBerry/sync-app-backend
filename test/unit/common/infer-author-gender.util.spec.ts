import { inferAuthorGenderFromPost } from '@src/common/utils/infer-author-gender.util';

describe('inferAuthorGenderFromPost', () => {
  it('detects female demo authors', () => {
    expect(
      inferAuthorGenderFromPost({
        userId: 'demo-luna',
        authorName: 'Luna',
        body: '上海出发，2人女生',
      }),
    ).toBe('female');
  });

  it('detects male demo authors', () => {
    expect(
      inferAuthorGenderFromPost({
        userId: 'demo-ryan',
        authorName: 'Ryan',
        body: '3缺1男生',
      }),
    ).toBe('male');
  });

  it('infers female from tags when user id unknown', () => {
    expect(
      inferAuthorGenderFromPost({
        authorName: 'Zara Chen',
        tags: ['#女生优先'],
        body: '帮我组队',
      }),
    ).toBe('female');
  });
});
