import {
  categoryForInteractionType,
  categoryForTemplateKey,
} from '@src/modules/notification/notification-category.util';

describe('notification-category.util', () => {
  it('maps interaction types to categories', () => {
    expect(categoryForInteractionType('like')).toBe('like');
    expect(categoryForInteractionType('comment_reply')).toBe('comment');
    expect(categoryForInteractionType('post_rejected')).toBe('system');
  });

  it('maps template keys to categories', () => {
    expect(categoryForTemplateKey('like')).toBe('like');
    expect(categoryForTemplateKey('activityUpdate')).toBe('system');
  });
});
