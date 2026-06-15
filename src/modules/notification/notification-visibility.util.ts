import type { NotificationMeta } from '../../database/schemas/notification.schema';

const DEPRECATED_META_TYPES = new Set<string>([
  'like',
  'comment',
  'comment_reply',
  'application',
  'team_dissolved',
  'team_accepted',
]);

const DEPRECATED_CATEGORIES = new Set<string>([
  'like',
  'comment',
  'application',
]);

const DEPRECATED_TEMPLATE_KEY_RE =
  /notifications\.types\.(like|comment|commentReply)/;

/** Legacy inbox entries that should no longer be listed or counted. */
export function isDeprecatedNotificationMeta(meta?: NotificationMeta): boolean {
  if (!meta) return false;
  if (meta.category && DEPRECATED_CATEGORIES.has(meta.category)) {
    return true;
  }
  if (meta.type && DEPRECATED_META_TYPES.has(meta.type)) {
    return true;
  }
  const templateKey = meta.templateKey?.trim() ?? '';
  return DEPRECATED_TEMPLATE_KEY_RE.test(templateKey);
}
