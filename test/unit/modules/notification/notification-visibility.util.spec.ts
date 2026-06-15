import { isDeprecatedNotificationMeta } from '@src/modules/notification/notification-visibility.util';

describe('notification-visibility.util', () => {
  it('flags like and comment notifications as deprecated', () => {
    expect(isDeprecatedNotificationMeta({ type: 'like' })).toBe(true);
    expect(isDeprecatedNotificationMeta({ type: 'comment' })).toBe(true);
    expect(isDeprecatedNotificationMeta({ type: 'comment_reply' })).toBe(true);
    expect(isDeprecatedNotificationMeta({ category: 'like' as never })).toBe(
      true,
    );
    expect(
      isDeprecatedNotificationMeta({
        templateKey: 'notifications.types.comment',
      }),
    ).toBe(true);
  });

  it('keeps system notifications visible', () => {
    expect(
      isDeprecatedNotificationMeta({
        type: 'activity_update',
        category: 'system',
      }),
    ).toBe(false);
    expect(
      isDeprecatedNotificationMeta({
        type: 'post_hidden',
        category: 'system',
      }),
    ).toBe(false);
  });
});
