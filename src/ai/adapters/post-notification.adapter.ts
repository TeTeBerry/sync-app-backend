import { Injectable } from '@nestjs/common';
import { NoticeAgent } from '../agents/notice.agent';
import type { IPostNotificationPort } from '../../modules/partner/ports/post-notification.port';
import type { PostRecord } from '../../modules/partner/interfaces/post.repository.interface';

@Injectable()
export class PostNotificationAdapter implements IPostNotificationPort {
  constructor(private readonly noticeAgent: NoticeAgent) {}

  notifyPostHidden(
    userId: string,
    postId: string,
    activityLegacyId?: number,
    reason?: string,
  ): void {
    void this.noticeAgent.notifyPostHidden(
      userId,
      postId,
      activityLegacyId,
      reason,
    );
  }

  notifyLike(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    authorName?: string,
  ): void {
    void this.noticeAgent.notifyLike(post, postId, actorUserId, authorName);
  }

  notifyApplication(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    authorName?: string,
  ): void {
    void this.noticeAgent.notifyApplication(
      post,
      postId,
      actorUserId,
      authorName,
    );
  }

  notifyComment(
    post: PostRecord,
    postId: string,
    actorUserId: string,
    authorName: string | undefined,
    preview: string,
  ): void {
    void this.noticeAgent.notifyComment(
      post,
      postId,
      actorUserId,
      authorName,
      preview,
    );
  }

  notifyCommentReply(
    post: PostRecord,
    postId: string,
    parentComment: { _id?: unknown; userId: string; authorName?: string },
    actorUserId: string,
    actorName: string | undefined,
    preview: string,
  ): void {
    void this.noticeAgent.notifyCommentReply(
      post,
      postId,
      parentComment,
      actorUserId,
      actorName,
      preview,
    );
  }

  notifyApplicationAccepted(
    applicantUserId: string,
    postId: string,
    activityLegacyId: number | undefined,
    ownerName: string,
  ): void {
    void this.noticeAgent.notifyApplicationAccepted(
      applicantUserId,
      postId,
      activityLegacyId,
      ownerName,
    );
  }

  notifyTeamDissolved(
    recipientUserId: string,
    postId: string,
    activityLegacyId: number | undefined,
    actorName: string,
  ): void {
    void this.noticeAgent.notifyTeamDissolved(
      recipientUserId,
      postId,
      activityLegacyId,
      actorName,
    );
  }
}
