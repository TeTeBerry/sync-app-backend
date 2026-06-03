import {
  categoryForInteractionType,
  categoryForTemplateKey,
} from '@src/modules/notification/notification-category.util';

describe('notification-category.util', () => {
  it('maps interaction types to categories', () => {
    expect(categoryForInteractionType('like')).toBe('like');
    expect(categoryForInteractionType('comment_reply')).toBe('comment');
    expect(categoryForInteractionType('application')).toBe('application');
    expect(categoryForInteractionType('team_dissolved')).toBe('application');
    expect(categoryForInteractionType('post_rejected')).toBe('system');
  });

  it('maps template keys to categories', () => {
    expect(categoryForTemplateKey('teamAccepted')).toBe('application');
    expect(categoryForTemplateKey('application')).toBe('application');
    expect(categoryForTemplateKey('activityUpdate')).toBe('system');
  });
});
