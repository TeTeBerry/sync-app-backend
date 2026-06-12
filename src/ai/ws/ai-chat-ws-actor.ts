import type { JwtBearerActor } from '../../common/auth/jwt-bearer.util';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { resolveActorUserId } from '../../common/auth/actor-user.util';

export type WsChatActorBody = {
  userId?: string;
  userName?: string;
  userPhone?: string;
};

export type ResolveWsChatActorResult =
  | { ok: true; actor: RequestActor; userPhone?: string }
  | { ok: false; message: string };

/**
 * REST uses RequestActorMiddleware on `req.actor`; WS uses upgrade Authorization + body.
 * - Valid Bearer: actor from JWT; body `userId` must match `sub` when present.
 * - No Bearer: anonymous session — require body `userId`.
 */
export function resolveWsChatActor(
  jwtActor: JwtBearerActor | null,
  body: WsChatActorBody,
): ResolveWsChatActorResult {
  if (jwtActor) {
    const bodyUserId = body.userId?.trim();
    if (bodyUserId && bodyUserId !== jwtActor.userId) {
      return { ok: false, message: '用户身份与登录态不一致' };
    }

    return {
      ok: true,
      actor: {
        source: 'jwt',
        clientUserId: jwtActor.userId,
        displayName: jwtActor.userName,
        resolvedUserId: jwtActor.userId,
      },
      userPhone: body.userPhone?.trim() || undefined,
    };
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return {
      ok: false,
      message: '缺少用户身份（请登录或在消息中提供 userId）',
    };
  }

  const userName = body.userName?.trim() || '用户';
  const resolvedUserId = resolveActorUserId(userId);

  return {
    ok: true,
    actor: {
      source: 'anonymous',
      clientUserId: userId,
      displayName: userName,
      resolvedUserId,
    },
    userPhone: body.userPhone?.trim() || undefined,
  };
}
