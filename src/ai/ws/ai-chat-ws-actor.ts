import type { JwtBearerActor } from '../../common/auth/jwt-bearer.util';

export type WsChatActorBody = {
  userId?: string;
  userName?: string;
  userPhone?: string;
};

export type ResolvedWsChatActor = {
  userId: string;
  userName: string;
  userPhone?: string;
};

export type ResolveWsChatActorResult =
  | { ok: true; actor: ResolvedWsChatActor; source: 'jwt' | 'body' }
  | { ok: false; message: string };

/**
 * REST uses JwtActorMiddleware on query; WS uses upgrade Authorization + optional body.
 * - Valid Bearer: actor from JWT; body `userId` must match `sub` when present.
 * - No Bearer: demo / legacy — require body `userId`.
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
      source: 'jwt',
      actor: {
        userId: jwtActor.userId,
        userName: jwtActor.userName,
        userPhone: body.userPhone?.trim() || undefined,
      },
    };
  }

  const userId = body.userId?.trim();
  if (!userId) {
    return { ok: false, message: '缺少用户身份（请登录或在消息中提供 userId）' };
  }

  const userName = body.userName?.trim() || '用户';
  return {
    ok: true,
    source: 'body',
    actor: {
      userId,
      userName,
      userPhone: body.userPhone?.trim() || undefined,
    },
  };
}
