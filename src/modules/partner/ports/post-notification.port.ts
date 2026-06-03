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

  notifyApplication(
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

  /** 帖主接受组队申请，通知申请人。 */
  notifyApplicationAccepted(
    applicantUserId: string,
    postId: string,
    activityLegacyId: number | undefined,
    ownerName: string,
  ): void;

  /** 帖主将已组队帖改回招募中，通知原组队对象关系已解散。 */
  notifyTeamDissolved(
    recipientUserId: string,
    postId: string,
    activityLegacyId: number | undefined,
    actorName: string,
  ): void;
}

export const POST_NOTIFICATION_PORT = Symbol('POST_NOTIFICATION_PORT');
