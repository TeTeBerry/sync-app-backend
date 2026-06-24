import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { parseActivityLegacyIdHeader } from '../activity/activity-context.util';

/**
 * Parses `X-Activity-Id` for REST routes. Does not override body/query — merge at call sites.
 */
@Injectable()
export class ActivityContextMiddleware implements NestMiddleware {
  use(req: Request, _res: Response, next: NextFunction): void {
    req.scopedActivityLegacyId = parseActivityLegacyIdHeader(req.headers);
    next();
  }
}
