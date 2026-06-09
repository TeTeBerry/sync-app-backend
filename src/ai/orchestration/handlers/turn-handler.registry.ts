import { Injectable } from '@nestjs/common';
import { DjInfoTurnHandler } from './dj-info-turn.handler';
import type { TurnHandlerContext } from './turn-handler.types';
import type { AiStreamEvent } from '../../../shared/chat';

@Injectable()
export class TurnHandlerRegistry {
  constructor(private readonly djInfoTurnHandler: DjInfoTurnHandler) {}

  async runSpecializedIntent(
    ctx: TurnHandlerContext,
  ): Promise<AiStreamEvent[] | null> {
    if (this.djInfoTurnHandler.supports(ctx)) {
      return this.djInfoTurnHandler.run(ctx);
    }
    return null;
  }
}
