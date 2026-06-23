import { Injectable } from '@nestjs/common';
import { DjInfoService } from '../../dj/dj-info.service';
import { AiStreamEventBuilder } from '../../presentation/ai-stream-event.builder';
import type { AiStreamEvent } from '@sync/chat-contracts';
import type { TurnHandlerContext } from './turn-handler.types';

@Injectable()
export class DjInfoTurnHandler {
  constructor(
    private readonly djInfoService: DjInfoService,
    private readonly sseBuilder: AiStreamEventBuilder,
  ) {}

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
