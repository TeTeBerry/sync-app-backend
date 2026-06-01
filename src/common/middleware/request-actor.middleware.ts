import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import {
  AUTH_SESSION_EXPIRED_MESSAGE,
  classifyBearerAuth,
} from '../auth/jwt-bearer.util';

/**
 * Rejects invalid Bearer before route handlers.
 * Actor resolution is done by `JwtAuthGuard` on protected routes.
 */
@Injectable()
export class RequestActorMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const auth = classifyBearerAuth(this.jwtService, req.headers.authorization);

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
