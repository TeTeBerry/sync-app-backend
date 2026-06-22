import type {
  NotificationCategory,
  NotificationMeta,
  NotificationType,
} from '../../database/schemas/notification.schema';

export type NotificationTemplateKey =
  | 'postRejected'
  | 'postHidden'
  | 'activityUpdate'
  | 'comment'
  | 'commentReply';

export const NOTIFICATION_CATEGORY_BY_TEMPLATE: Record<
  NotificationTemplateKey,
  NotificationCategory
> = {
  postRejected: 'system',
  postHidden: 'system',
  activityUpdate: 'system',
  comment: 'general',
  commentReply: 'general',
};

const TEMPLATE_DEFAULTS: Record<
  NotificationTemplateKey,
  { type: NotificationType; title: string; body: string }
> = {
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
  comment: {
    type: 'interaction',
    title: '招募帖收到新公开回复',
    body: '{{actor}} 公开回复了你的招募帖：{{preview}}',
  },
  commentReply: {
    type: 'interaction',
    title: '收到新公开回复',
    body: '{{actor}} 公开回复了你的评论：{{preview}}',
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
