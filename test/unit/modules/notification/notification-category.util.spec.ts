import {
  categoryForInteractionType,
  categoryForTemplateKey,
} from '@src/modules/notification/notification-category.util';

describe('notification-category.util', () => {
  it('maps interaction types to categories', () => {
    expect(categoryForInteractionType('like')).toBe('general');
    expect(categoryForInteractionType('comment_reply')).toBe('general');
    expect(categoryForInteractionType('post_rejected')).toBe('system');
  });

  it('maps template keys to categories', () => {
    expect(categoryForTemplateKey('activityUpdate')).toBe('system');
  });
});
