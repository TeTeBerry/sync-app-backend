import { Injectable } from '@nestjs/common';
import { NoticeAgent } from '../agents/notice.agent';
import type { IPostNotificationPort } from '../../modules/partner/ports/post-notification.port';

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
}
