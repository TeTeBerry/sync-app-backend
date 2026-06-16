import {
  NOTIFICATION_CATEGORY_BY_TEMPLATE,
  buildNotificationFromTemplate,
} from '@src/modules/notification/notification-templates.util';

describe('notification-templates.util', () => {
  it('maps template keys to notice categories', () => {
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.activityUpdate).toBe('system');
  });

  it('renders activity update notification with category in meta', () => {
    const built = buildNotificationFromTemplate(
      'activityUpdate',
      { activityName: '风暴电音节', changeSummary: '地点已更新' },
      {
        type: 'activity_update',
      },
    );

    expect(built.type).toBe('system');
    expect(built.title).toContain('活动信息变更');
    expect(built.body).toContain('风暴电音节');
    expect(built.meta.category).toBe('system');
    expect(built.meta.templateKey).toBe('notifications.types.activityUpdate');
  });
});
