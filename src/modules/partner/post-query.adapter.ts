import { Injectable } from '@nestjs/common';
import { PostCommentService } from './application/post-comment.service';
import { PostQueryService } from './application/post-query.service';
import type { IPostQueryPort } from './ports/post-query.port';

@Injectable()
export class PostQueryAdapter implements IPostQueryPort {
  constructor(
    private readonly postQuery: PostQueryService,
    private readonly postComments: PostCommentService,
  ) {}

  findPostById(id: string) {
    return this.postQuery.findPostById(id);
  }

  findOwnerActivePostForActivity(
    activityLegacyId: number,
    actor: Parameters<PostQueryService['findOwnerActivePostForActivity']>[1],
  ) {
    return this.postQuery.findOwnerActivePostForActivity(
      activityLegacyId,
      actor,
    );
  }

  listComments(id: string, options?: { limit?: number; cursor?: string }) {
    return this.postComments.listComments(id, options);
  }
}
