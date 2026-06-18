import { Controller, Delete, Get, Param, Query } from '@nestjs/common';
import { Public } from '../../common/auth/public.decorator';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(private readonly chatService: ChatService) {}

  @Public()
  @Get('health')
  health() {
    return this.chatService.health();
  }

  /** Public: session id is client-generated secret; used to hydrate AI chat on return. */
  @Public()
  @Get('sessions/:sessionId')
  getSession(@Param('sessionId') sessionId: string) {
    return this.chatService.getSession(sessionId);
  }

  @Public()
  @Get('sessions/:sessionId/messages')
  getSessionMessages(
    @Param('sessionId') sessionId: string,
    @Query('limit') limitRaw?: string,
    @Query('before') beforeRaw?: string,
  ) {
    const limit = limitRaw != null ? Number(limitRaw) : undefined;
    const before = beforeRaw != null ? Number(beforeRaw) : undefined;
    return this.chatService.getSessionMessages(sessionId, {
      limit: Number.isFinite(limit) ? limit : undefined,
      before: Number.isFinite(before) ? before : undefined,
    });
  }

  @Delete('sessions/:sessionId')
  async clearSession(@Param('sessionId') sessionId: string) {
    await this.chatService.clearSession(sessionId);
    return { ok: true, sessionId };
  }
}
