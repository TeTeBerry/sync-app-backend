import { Inject, Injectable } from '@nestjs/common';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { resolveOwnerFilterFromActor } from '../../common/utils/owner-filter.util';
import { PostQueryService } from './application/post-query.service';
import {
  IPostRepository,
  POST_REPOSITORY,
} from './interfaces/post.repository.interface';
import type { IPostReadPort } from './ports/post-read.port';

@Injectable()
export class PostReadAdapter implements IPostReadPort {
  constructor(
    private readonly postQuery: PostQueryService,
    @Inject(POST_REPOSITORY)
    private readonly repository: IPostRepository,
  ) {}

  listPopular(limit: number, actor: RequestActor) {
    return this.postQuery.listPopular(limit, actor);
  }

  listByOwner(actor: RequestActor) {
    return this.postQuery.listByOwner(actor);
  }

  countCompletedByOwner(actor: RequestActor) {
    return this.repository.countCompletedByOwner(
      resolveOwnerFilterFromActor(actor),
    );
  }
}
