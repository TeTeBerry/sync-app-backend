import {
  NOTIFICATION_CATEGORY_BY_TEMPLATE,
  buildNotificationFromTemplate,
} from '@src/modules/notification/notification-templates.util';

describe('notification-templates.util', () => {
  it('maps template keys to notice categories', () => {
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.like).toBe('like');
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.comment).toBe('comment');
    expect(NOTIFICATION_CATEGORY_BY_TEMPLATE.matchRecommendation).toBe(
      'buddy_recommend',
    );
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

  it('renders match recommendation with buddy_recommend category', () => {
    const built = buildNotificationFromTemplate(
      'matchRecommendation',
      { activityName: 'EDC', count: '3' },
      { type: 'match_recommendation', activityLegacyId: 42 },
    );

    expect(built.type).toBe('match');
    expect(built.meta.category).toBe('buddy_recommend');
    expect(built.body).toContain('EDC');
    expect(built.body).toContain('3');
  });
});
