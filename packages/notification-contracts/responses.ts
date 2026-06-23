import type { NotificationMeta, NotificationType } from './types';

/** REST notification item (`GET /api/notifications`). */
export interface AppNotification {
  id: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  read: boolean;
  meta?: NotificationMeta;
  createdAt: string;
}
