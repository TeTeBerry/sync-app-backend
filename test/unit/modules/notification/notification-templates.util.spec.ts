import {
  NOTIFICATION_CATEGORY_BY_TEMPLATE,
  buildNotificationFromTemplate,
} from '@src/modules/notification/notification-templates.util';

describe('notification-templates.util', () => {
  it('maps template keys to notice categories', () => {
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.like).toBe('like');
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.comment).toBe('comment');
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.postRejected).toBe('system');
  });

  it('renders like notification with category in meta', () => {
    const built = buildNotificationFromTemplate('like', { actor: 'Alex' }, {
      postId: 'post-1',
      type: 'like',
    });

    expect(built.type).toBe('interaction');
    expect(built.title).toContain('赞');
    expect(built.body).toContain('Alex');
    expect(built.meta.category).toBe('like');
    expect(built.meta.templateKey).toBe('notifications.types.like');
  });

});
