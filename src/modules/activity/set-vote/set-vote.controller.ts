import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import { Public } from '../../../common/auth/public.decorator';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { SetVoteService } from './set-vote.service';
import { SubmitSetVoteDto } from './dto/submit-set-vote.dto';

@ApiTags('activities')
@Controller('activities/:legacyId/set-votes')
export class SetVoteController {
  constructor(private readonly setVoteService: SetVoteService) {}

  @Post()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Submit or update set-vote picks (max 3 DJs)' })
  submit(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: SubmitSetVoteDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.setVoteService.submit(
      legacyId,
      body.artistIds,
      actor,
      body.syncGenres,
    );
  }

  @Public()
  @Get('leaderboard')
  @ApiOperation({ summary: 'Get set-vote leaderboard for activity' })
  leaderboard(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.setVoteService.getLeaderboard(legacyId, actor);
  }

  @Get('me')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Get current user set-vote for activity' })
  me(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.setVoteService.getMe(legacyId, actor);
  }
}
