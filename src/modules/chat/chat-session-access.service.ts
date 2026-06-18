import { ForbiddenException, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';

@Injectable()
export class ChatSessionAccessService {
  assertSessionReadable(
    sessionUserId: string | undefined,
    actor: RequestActor,
  ): void {
    if (actor.source !== 'jwt') {
      throw new ForbiddenException('请先登录后查看对话历史');
    }

    const owner = sessionUserId?.trim();
    if (owner && owner !== actor.resolvedUserId) {
      throw new ForbiddenException('无权访问该对话');
    }
  }

  assertSessionWritable(
    sessionUserId: string | undefined,
    actor: RequestActor,
  ): void {
    this.assertSessionReadable(sessionUserId, actor);
  }
}
