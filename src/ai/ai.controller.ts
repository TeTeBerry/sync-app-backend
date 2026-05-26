import { Body, Controller, Headers, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { ChatRequestDto } from './presentation/chat-request.dto';
import { initSseResponse, writeSseEvent } from './utils/sse.util';
import { createRequestId } from './utils/log-ai-turn.util';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(
    @Body() body: ChatRequestDto,
    @Headers('x-request-id') requestIdHeader: string | undefined,
    @Res() res: Response,
  ) {
    initSseResponse(res);
    const requestId = createRequestId(requestIdHeader);

    try {
      for await (const event of this.aiService.streamChat(body, { requestId })) {
        writeSseEvent(res, event);
        if (event.type === 'error') {
          break;
        }
      }
    } catch (error) {
      writeSseEvent(res, {
        type: 'error',
        message:
          error instanceof Error ? error.message : 'AI 对话失败，请稍后重试',
      });
    } finally {
      res.end();
    }
  }
}
