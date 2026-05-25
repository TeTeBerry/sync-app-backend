import { Injectable, Inject } from '@nestjs/common';
import type { ReplyHandler, ReplyContext } from './handler-pipeline.types';

export const HANDLER_REGISTRY_TOKEN = 'HANDLER_REGISTRY_TOKEN';

@Injectable()
export class HandlerRegistryService {
  constructor(@Inject(HANDLER_REGISTRY_TOKEN) private readonly handlers: ReplyHandler[]) {}

  async findMatching(ctx: ReplyContext): Promise<ReplyHandler | null> {
    for (const handler of this.handlers) {
      if (await handler.canHandle(ctx)) return handler;
    }
    return null;
  }

  all(): ReplyHandler[] {
    return this.handlers;
  }
}
