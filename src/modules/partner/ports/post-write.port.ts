import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { CreatePostDto } from '../dto/create-post.dto';

export interface CreatedPostSummary {
  id: string;
}

export interface IPostWritePort {
  createPost(
    dto: CreatePostDto,
    actor: RequestActor,
    options?: { skipRiskCheck?: boolean },
  ): Promise<CreatedPostSummary>;
  addComment(
    id: string,
    body: string,
    actor: RequestActor,
    parentCommentId?: string,
  ): Promise<unknown>;
}

export const POST_WRITE_PORT = Symbol('POST_WRITE_PORT');
