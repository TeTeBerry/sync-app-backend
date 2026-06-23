import { Injectable } from '@nestjs/common';
import { PostCommentService } from './application/post-comment.service';
import { PostWriteService } from './application/post-write.service';
import type { IPostWritePort } from './ports/post-write.port';

@Injectable()
export class PostWriteAdapter implements IPostWritePort {
  constructor(
    private readonly postWrite: PostWriteService,
    private readonly postComments: PostCommentService,
  ) {}

  async createPost(
    dto: Parameters<PostWriteService['createPost']>[0],
    actor: Parameters<PostWriteService['createPost']>[1],
    options?: Parameters<PostWriteService['createPost']>[2],
  ) {
    const created = await this.postWrite.createPost(dto, actor, options);
    return { id: created.id };
  }

  addComment(
    id: string,
    body: string,
    actor: Parameters<PostCommentService['addComment']>[2],
    parentCommentId?: string,
  ) {
    return this.postComments.addComment(id, body, actor, parentCommentId);
  }
}
