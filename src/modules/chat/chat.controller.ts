import { Controller, Delete, Get, Param } from '@nestjs/common';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Get('health')
  health() {
    return this.chatService.health();
  }

  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.chatService.getSession(sessionId);
  }

  @Delete('sessions/:sessionId')
  async clearSession(@Param('sessionId') sessionId: string) {
    await this.chatService.clearSession(sessionId);
    return { ok: true, sessionId };
  }
}
