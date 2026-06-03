import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AUTH_SESSION_EXPIRED_MESSAGE } from '../auth/jwt-bearer.util';
import { AuthService } from '../../modules/auth/auth.service';

/**
 * Rejects invalid Bearer before route handlers.
 * Actor resolution is done by `JwtAuthGuard` on protected routes.
 */
@Injectable()
export class RequestActorMiddleware implements NestMiddleware {
  constructor(private readonly authService: AuthService) {}

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    const auth = await this.authService.resolveBearerAuth(
      req.headers.authorization,
    );

    if (auth.kind === 'invalid') {
      res.status(401).json({
        code: 401,
        message: AUTH_SESSION_EXPIRED_MESSAGE,
        data: null,
      });
      return;
    }

    next();
  }
}
