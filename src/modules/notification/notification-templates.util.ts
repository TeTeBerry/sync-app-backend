import type {
  NotificationCategory,
  NotificationMeta,
  NotificationType,
} from '../../database/schemas/notification.schema';

export type NotificationTemplateKey =
  | 'like'
  | 'comment'
  | 'commentReply'
  | 'application'
  | 'postRejected'
  | 'postHidden'
  | 'activityUpdate'
  | 'teamDissolved'
  | 'teamAccepted';

export const NOTIFICATION_CATEGORY_BY_TEMPLATE: Record<
  NotificationTemplateKey,
  NotificationCategory
> = {
  like: 'like',
  comment: 'comment',
  commentReply: 'comment',
  application: 'application',
  postRejected: 'system',
  postHidden: 'system',
  activityUpdate: 'system',
  teamDissolved: 'application',
  teamAccepted: 'application',
};

const TEMPLATE_DEFAULTS: Record<
  NotificationTemplateKey,
  { type: NotificationType; title: string; body: string }
> = {
  like: {
    type: 'interaction',
    title: '有人赞了你的组队帖',
    body: '{{actor}} 赞了你的帖子',
  },
  comment: {
    type: 'interaction',
    title: '有人评论了你的组队帖',
    body: '{{actor}}：{{preview}}',
  },
  commentReply: {
    type: 'interaction',
    title: '有人回复了你的评论',
    body: '{{actor}}：{{preview}}',
  },
  application: {
    type: 'interaction',
    title: '有人申请加入你的组队',
    body: '{{actor}} 申请加入你的组队帖',
  },
  postRejected: {
    type: 'system',
    title: '组队帖审核未通过',
    body: '{{reason}}',
  },
  postHidden: {
    type: 'system',
    title: '组队帖已自动隐藏',
    body: '{{reason}}',
  },
  activityUpdate: {
    type: 'system',
    title: '活动信息变更',
    body: '「{{activityName}}」{{changeSummary}}',
  },
  teamDissolved: {
    type: 'system',
    title: '组队关系已解除',
    body: '{{actor}} 将组队帖改回招募中，你们的组队关系已解散，双方帖子恢复招募',
  },
  teamAccepted: {
    type: 'interaction',
    title: '组队申请已通过',
    body: '{{actor}} 已接受你的组队申请，相关帖子已标记为已组队',
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
