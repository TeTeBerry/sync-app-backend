import { JwtService } from '@nestjs/jwt';
import type { AuthTokenPayload } from '../../modules/auth/auth.service';

export const AUTH_SESSION_EXPIRED_MESSAGE = '登录已过期，请重新登录';

export interface JwtBearerActor {
  userId: string;
  userName: string;
}

export type BearerAuthKind = 'absent' | 'valid' | 'invalid';

export type ClassifyBearerAuthResult =
  | { kind: 'absent' }
  | { kind: 'valid'; actor: JwtBearerActor }
  | { kind: 'invalid' };

/** Extract raw JWT from `Authorization: Bearer <token>`. */
export function extractBearerToken(
  authorization?: string | string[],
): string | null {
  const raw = Array.isArray(authorization) ? authorization[0] : authorization;
  if (!raw?.startsWith('Bearer ')) {
    return null;
  }
  const token = raw.slice('Bearer '.length).trim();
  return token || null;
}

/** Classify Bearer header: missing, valid JWT actor, or present-but-invalid. */
export function classifyBearerAuth(
  jwtService: JwtService,
  authorization?: string | string[],
): ClassifyBearerAuthResult {
  const token = extractBearerToken(authorization);
  if (!token) {
    return { kind: 'absent' };
  }

  try {
    const payload = jwtService.verify<AuthTokenPayload>(token);
    const userId = payload.sub?.trim();
    if (!userId) {
      return { kind: 'invalid' };
    }
    return {
      kind: 'valid',
      actor: {
        userId,
        userName: payload.name?.trim() || '用户',
      },
    };
  } catch {
    return { kind: 'invalid' };
  }
}

/** Verify Bearer JWT; returns null when missing, invalid, or empty `sub`. */
export function verifyBearerActor(
  jwtService: JwtService,
  authorization?: string | string[],
): JwtBearerActor | null {
  const auth = classifyBearerAuth(jwtService, authorization);
  return auth.kind === 'valid' ? auth.actor : null;
}
