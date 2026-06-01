import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublishLiveInfoDto } from './dto/publish-live-info.dto';
import { SubmitLiveInfoWristbandDto } from './dto/submit-wristband.dto';
import { LiveInfoService } from './live-info.service';

@Controller('activities/:legacyId/live-info')
export class LiveInfoController {
  constructor(private readonly liveInfoService: LiveInfoService) {}

  @Get()
  getSnapshot(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.liveInfoService.getSnapshot(legacyId, actor);
  }

  @Post('wristband')
  submitWristband(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: SubmitLiveInfoWristbandDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.liveInfoService.submitWristband(legacyId, body, actor);
  }

  @Delete('wristband')
  clearWristband(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.liveInfoService.clearWristband(legacyId, actor);
  }

  @Post('updates')
  publishUpdate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: PublishLiveInfoDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.liveInfoService.publishUpdate(legacyId, body, actor);
  }

  @Post('updates/:updateId/like')
  toggleLike(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Param('updateId') updateId: string,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.liveInfoService.toggleLike(legacyId, updateId, actor);
  }
}
