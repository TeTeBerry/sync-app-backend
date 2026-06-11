import type { PostRecord } from '../interfaces/post.repository.interface';

export interface IPostNotificationPort {
  notifyPostHidden(
    userId: string,
    postId: string,
    activityLegacyId?: number,
    reason?: string,
  ): void;

  notifyLike(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    authorName?: string,
  ): void;

  notifyComment(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    authorName: string | undefined,
    preview: string,
  ): void;

  notifyCommentReply(
    post: PostRecord,
    postId: string,
    parentComment: { _id?: unknown; userId: string; authorName?: string },
    actorUserId: string,
    actorName: string | undefined,
    preview: string,
  ): void;
}

export const POST_NOTIFICATION_PORT = Symbol('POST_NOTIFICATION_PORT');
