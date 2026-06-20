import { Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PostQueryService } from './application/post-query.service';
import type { IPostReadPort } from './ports/post-read.port';

@Injectable()
export class PostReadAdapter implements IPostReadPort {
  constructor(private readonly postQuery: PostQueryService) {}

  listPopular(limit: number, actor: RequestActor) {
    return this.postQuery.listPopular(limit, actor);
  }

  listByOwner(actor: RequestActor) {
    return this.postQuery.listByOwner(actor);
  }

  listByOwnerPage(
    actor: RequestActor,
    options?: { limit?: number; cursor?: string },
  ) {
    return this.postQuery.listByOwnerPage(actor, options);
  }
}
