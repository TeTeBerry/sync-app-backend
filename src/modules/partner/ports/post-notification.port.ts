import type { PostRecord } from '../interfaces/post.repository.interface';

export interface CommentNotificationInput {
  recipientUserId: string;
  postId: string;
  activityLegacyId?: number;
  activityTitle?: string;
  actorUserId: string;
  actorUserName?: string;
  commentPreview?: string;
  parentCommentId?: string;
}

export interface IPostNotificationPort {
  notifyPostHidden(
    userId: string,
    postId: string,
    activityLegacyId?: number,
    reason?: string,
  ): void;

  notifyComment(input: CommentNotificationInput): void;

  notifyCommentReply(
    input: CommentNotificationInput & { parentCommentId: string },
  ): void;
}

export const POST_NOTIFICATION_PORT = Symbol('POST_NOTIFICATION_PORT');
