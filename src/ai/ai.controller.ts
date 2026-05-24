import { Body, Controller, Post, Res } from '@nestjs/common';
import { Response } from 'express';
import { AiService } from './ai.service';
import { ChatRequestDto } from './dto/chat.dto';
import { initSseResponse, writeSseEvent } from './utils/sse.util';

@Controller('ai')
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('chat')
  async chat(@Body() body: ChatRequestDto, @Res() res: Response) {
    initSseResponse(res);

    try {
      for await (const event of this.aiService.streamChat(body)) {
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
