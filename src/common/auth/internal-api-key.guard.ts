import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

const INVALID_KEY_MESSAGE = 'Invalid internal API key';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const expected = this.config.get<string>('internal.apiKey')?.trim() ?? '';
    if (!expected) {
      throw new UnauthorizedException(INVALID_KEY_MESSAGE);
    }

    const request = context.switchToHttp().getRequest<Request>();
    const header = request.headers['x-internal-api-key'];
    const provided = typeof header === 'string' ? header.trim() : '';

    if (!provided || provided !== expected) {
      throw new UnauthorizedException(INVALID_KEY_MESSAGE);
    }

    return true;
  }
}
