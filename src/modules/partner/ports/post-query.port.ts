import type { RequestActor } from '../../../common/auth/request-actor.types';
import type { PostRecord } from '../interfaces/post.repository.interface';

export interface OwnerActivePostSummary {
  id: string;
  body: string;
  eventTitle?: string;
  activityLegacyId?: number;
  departureCity?: string;
}

export interface PostCommentListPage {
  items: Array<{
    authorName?: string;
    body: string;
    replies?: Array<{ authorName?: string; body: string }>;
  }>;
  hasMore: boolean;
  nextCursor?: string;
}

export interface IPostQueryPort {
  findPostById(id: string): Promise<PostRecord | null>;
  findOwnerActivePostForActivity(
    activityLegacyId: number,
    actor: RequestActor,
  ): Promise<OwnerActivePostSummary | null>;
  listComments(
    id: string,
    options?: { limit?: number; cursor?: string },
  ): Promise<PostCommentListPage>;
}

export const POST_QUERY_PORT = Symbol('POST_QUERY_PORT');
