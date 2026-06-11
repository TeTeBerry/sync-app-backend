import type {
  NotificationCategory,
  NotificationMeta,
  NotificationType,
} from '../../database/schemas/notification.schema';

export type NotificationTemplateKey =
  | 'like'
  | 'comment'
  | 'commentReply'
  | 'postRejected'
  | 'postHidden'
  | 'activityUpdate';

export const NOTIFICATION_CATEGORY_BY_TEMPLATE: Record<
  NotificationTemplateKey,
  NotificationCategory
> = {
  like: 'like',
  comment: 'comment',
  commentReply: 'comment',
  postRejected: 'system',
  postHidden: 'system',
  activityUpdate: 'system',
};

const TEMPLATE_DEFAULTS: Record<
  NotificationTemplateKey,
  { type: NotificationType; title: string; body: string }
> = {
  like: {
    type: 'interaction',
    title: '有人赞了你的帖子',
    body: '{{actor}} 赞了你的帖子',
  },
  comment: {
    type: 'interaction',
    title: '有人评论了你的帖子',
    body: '{{actor}}：{{preview}}',
  },
  commentReply: {
    type: 'interaction',
    title: '有人回复了你的评论',
    body: '{{actor}}：{{preview}}',
  },
  postRejected: {
    type: 'system',
    title: '帖子审核未通过',
    body: '{{reason}}',
  },
  postHidden: {
    type: 'system',
    title: '帖子已自动隐藏',
    body: '{{reason}}',
  },
  activityUpdate: {
    type: 'system',
    title: '活动信息变更',
    body: '「{{activityName}}」{{changeSummary}}',
  },
};

function renderTemplate(
  template: string,
  params: Record<string, string>,
): string {
  return template.replace(
    /\{\{(\w+)\}\}/g,
    (_, key: string) => params[key] ?? '',
  );
}

export function buildNotificationFromTemplate(
  templateKey: NotificationTemplateKey,
  params: Record<string, string>,
  meta: NotificationMeta = {},
): {
  type: NotificationType;
  title: string;
  body: string;
  meta: NotificationMeta;
} {
  const defaults = TEMPLATE_DEFAULTS[templateKey];
  const actor = params.actor?.trim() || '有人';

  const resolvedParams = { ...params, actor };
  return {
    type: defaults.type,
    title: renderTemplate(defaults.title, resolvedParams),
    body: renderTemplate(defaults.body, resolvedParams),
    meta: {
      ...meta,
      category: meta.category ?? NOTIFICATION_CATEGORY_BY_TEMPLATE[templateKey],
      templateKey: `notifications.types.${templateKey}`,
      templateParams: resolvedParams,
    },
  };
}
