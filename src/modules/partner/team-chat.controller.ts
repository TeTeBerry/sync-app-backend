import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { SendTeamChatMessageDto } from './dto/send-team-chat-message.dto';
import { TeamChatService } from './team-chat.service';

@Controller('team-chats')
export class TeamChatController {
  constructor(private readonly teamChatService: TeamChatService) {}

  @Get()
  listSessions(@CurrentActor() actor: RequestActor) {
    return this.teamChatService.listSessions(actor);
  }

  @Post(':postId/:applicantUserId/open')
  openChat(
    @Param('postId') postId: string,
    @Param('applicantUserId') applicantUserId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.teamChatService.openChatByOwner(postId, applicantUserId, actor);
  }

  @Get(':postId/:applicantUserId/messages')
  listMessages(
    @Param('postId') postId: string,
    @Param('applicantUserId') applicantUserId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.teamChatService.listMessages(postId, applicantUserId, actor);
  }

  @Post(':postId/:applicantUserId/read')
  markRead(
    @Param('postId') postId: string,
    @Param('applicantUserId') applicantUserId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.teamChatService.markThreadRead(postId, applicantUserId, actor);
  }

  @Post(':postId/:applicantUserId/messages')
  sendMessage(
    @Param('postId') postId: string,
    @Param('applicantUserId') applicantUserId: string,
    @Body() body: SendTeamChatMessageDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.teamChatService.sendMessage(
      postId,
      applicantUserId,
      body.body,
      actor,
    );
  }
}
