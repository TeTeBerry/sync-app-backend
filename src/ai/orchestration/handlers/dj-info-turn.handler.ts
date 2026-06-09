import { Injectable } from '@nestjs/common';
import { DjInfoService } from '../../dj/dj-info.service';
import { AiStreamEventBuilder } from '../../presentation/ai-sse.builder';
import type { AiStreamEvent } from '../../../shared/chat';
import type { TurnHandlerContext } from './turn-handler.types';

@Injectable()
export class DjInfoTurnHandler {
  constructor(
    private readonly djInfoService: DjInfoService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

  supports(ctx: TurnHandlerContext): boolean {
    return ctx.routed.kind === 'dj_info';
  }

  async run(ctx: TurnHandlerContext): Promise<AiStreamEvent[]> {
    const { replyText, suggestedReplies } =
      await this.djInfoService.answerFromChat(
        ctx.input,
        ctx.dto.activityLegacyId,
        { messages: ctx.messages },
      );
    ctx.sink.setReply(replyText);
    const events: AiStreamEvent[] = [{ type: 'delta', content: replyText }];
    const suggested =
      this.sseBuilder.djInfoSuggestedRepliesEvent(suggestedReplies);
    if (suggested) {
      events.push(suggested);
    }
    return events;
  }
}
