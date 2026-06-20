import type { RequestActor } from '../../../common/auth/request-actor.types';

export interface IPostReadPort {
  listPopular(limit: number, actor: RequestActor): Promise<unknown[]>;
  listByOwner(actor: RequestActor): Promise<unknown[]>;
  listByOwnerPage(
    actor: RequestActor,
    options?: { limit?: number; cursor?: string },
  ): Promise<{ items: unknown[]; nextCursor?: string; hasMore: boolean }>;
}

export const POST_READ_PORT = Symbol('POST_READ_PORT');
