import { Injectable, NestMiddleware } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NextFunction, Request, Response } from 'express';
import {
  AUTH_SESSION_EXPIRED_MESSAGE,
  classifyBearerAuth,
} from '../auth/jwt-bearer.util';

/**
 * When Authorization Bearer is present, inject userId/authorName into query
 * so existing controllers keep working without per-route changes.
 * Invalid Bearer always 401 (even if demo Query userId is present).
 */
@Injectable()
export class JwtActorMiddleware implements NestMiddleware {
  constructor(private readonly jwtService: JwtService) {}

  use(req: Request, res: Response, next: NextFunction): void {
    const auth = classifyBearerAuth(
      this.jwtService,
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

    if (auth.kind === 'valid') {
      req.query.userId = auth.actor.userId;
      req.query.authorName = auth.actor.userName;
    }

    next();
  }
}
