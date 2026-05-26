import { Injectable } from '@nestjs/common';
import { NoticeAgent } from '../agents/notice.agent';
import type { IPostNotificationPort } from '../../modules/post/ports/post-notification.port';
import type { PostRecord } from '../../modules/post/interfaces/post.repository.interface';

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
}
