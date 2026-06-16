import type {
  NotificationCategory,
  NotificationMeta,
  NotificationType,
} from '../../database/schemas/notification.schema';

export type NotificationTemplateKey = 'activityUpdate';

export const NOTIFICATION_CATEGORY_BY_TEMPLATE: Record<
  NotificationTemplateKey,
  NotificationCategory
> = {
  activityUpdate: 'system',
};

const TEMPLATE_DEFAULTS: Record<
  NotificationTemplateKey,
  { type: NotificationType; title: string; body: string }
> = {
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
