import type { RequestActor } from '../../../common/auth/request-actor.types';

export type ProfilePostLikeItem = { likes?: number | null };

export interface IPostReadPort {
  listPopular(limit: number, actor: RequestActor): Promise<unknown[]>;
  listByOwner(actor: RequestActor): Promise<ProfilePostLikeItem[]>;
}

export const POST_READ_PORT = Symbol('POST_READ_PORT');
