import { Controller, Delete, Get, Param, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../../common/auth/public.decorator';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { ChatSessionAccessService } from './chat-session-access.service';
import { ChatService } from './chat.service';

@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly sessionAccess: ChatSessionAccessService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return this.chatService.health();
  }

  @Get('sessions/:sessionId')
  async getSession(
    @Param('sessionId') sessionId: string,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'chat_session',
      req,
      actor.resolvedUserId,
    );
    const session = await this.chatService.getSession(sessionId);
    this.sessionAccess.assertSessionReadable(session.userId, actor);
    return session;
  }

  @Get('sessions/:sessionId/messages')
  async getSessionMessages(
    @Param('sessionId') sessionId: string,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
    @Query('limit') limitRaw?: string,
    @Query('before') beforeRaw?: string,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'chat_session',
      req,
      actor.resolvedUserId,
    );
    const session = await this.chatService.getSession(sessionId);
    this.sessionAccess.assertSessionReadable(session.userId, actor);

    const limit = limitRaw != null ? Number(limitRaw) : undefined;
    const before = beforeRaw != null ? Number(beforeRaw) : undefined;
    return this.chatService.getSessionMessages(sessionId, {
      limit: Number.isFinite(limit) ? limit : undefined,
      before: Number.isFinite(before) ? before : undefined,
    });
  }

  @Delete('sessions/:sessionId')
  async clearSession(
    @Param('sessionId') sessionId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    const session = await this.chatService.getSession(sessionId);
    this.sessionAccess.assertSessionWritable(session.userId, actor);
    await this.chatService.clearSession(sessionId);
    return { ok: true, sessionId };
  }
}
