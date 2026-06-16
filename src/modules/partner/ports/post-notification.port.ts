import type { PostRecord } from '../interfaces/post.repository.interface';

export interface IPostNotificationPort {
  notifyPostHidden(
    userId: string,
    postId: string,
    activityLegacyId?: number,
    reason?: string,
  ): void;
}

export const POST_NOTIFICATION_PORT = Symbol('POST_NOTIFICATION_PORT');
