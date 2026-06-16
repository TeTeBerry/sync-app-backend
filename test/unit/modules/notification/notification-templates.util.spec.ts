import {
  NOTIFICATION_CATEGORY_BY_TEMPLATE,
  buildNotificationFromTemplate,
} from '@src/modules/notification/notification-templates.util';

describe('notification-templates.util', () => {
  it('maps template keys to notice categories', () => {
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.postRejected).toBe('system');
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.activityUpdate).toBe('system');
  });

  it('renders post rejected notification with category in meta', () => {
    const built = buildNotificationFromTemplate(
      'postRejected',
      { reason: '内容未通过审核' },
      {
        type: 'post_rejected',
      },
    );

    expect(built.type).toBe('system');
    expect(built.title).toContain('审核');
    expect(built.body).toContain('内容未通过审核');
    expect(built.meta.category).toBe('system');
    expect(built.meta.templateKey).toBe('notifications.types.postRejected');
  });
});
