import type { RequestActor } from '../../../common/auth/request-actor.types';

export interface IPostReadPort {
  listPopular(limit: number, actor: RequestActor): Promise<unknown[]>;
  listByOwner(actor: RequestActor): Promise<unknown[]>;
}

export const POST_READ_PORT = Symbol('POST_READ_PORT');
