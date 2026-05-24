import { Controller, Get, Param } from '@nestjs/common';
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
    return this.chatService.getHistory(sessionId);
  }
}
