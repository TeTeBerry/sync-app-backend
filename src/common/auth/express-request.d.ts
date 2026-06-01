import type { RequestActor } from './request-actor.types';

declare global {
  namespace Express {
    interface Request {
      actor?: RequestActor;
      /** From `X-Activity-Id` header (`ActivityContextMiddleware`). */
      scopedActivityLegacyId?: number;
    }
  }
}

export {};
