import type {
  NotificationCategory,
  NotificationInteractionType,
} from '../../database/schemas/notification.schema';
import type { NotificationTemplateKey } from './notification-templates.util';
import { NOTIFICATION_CATEGORY_BY_TEMPLATE } from './notification-templates.util';

/** Maps interaction meta.type → client tab category. */
export function categoryForInteractionType(
  interactionType: NotificationInteractionType,
): NotificationCategory {
  switch (interactionType) {
    case 'like':
      return 'like';
    case 'comment':
    case 'comment_reply':
      return 'comment';
    case 'activity_update':
    case 'post_rejected':
    case 'post_hidden':
    case 'activity':
      return 'system';
    default:
      return 'general';
  }
}

export function categoryForTemplateKey(
  templateKey: NotificationTemplateKey,
): NotificationCategory {
  return NOTIFICATION_CATEGORY_BY_TEMPLATE[templateKey];
}
