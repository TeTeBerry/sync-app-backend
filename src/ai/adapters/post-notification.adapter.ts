import { Injectable } from '@nestjs/common';
import { NoticeAgent } from '../agents/notice.agent';
import type {
  CommentNotificationInput,
  IPostNotificationPort,
} from '../../modules/partner/ports/post-notification.port';

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

  notifyComment(input: CommentNotificationInput): void {
    void this.noticeAgent.notifyComment(input);
  }

  notifyCommentReply(
    input: CommentNotificationInput & { parentCommentId: string },
  ): void {
    void this.noticeAgent.notifyCommentReply(input);
  }
}
