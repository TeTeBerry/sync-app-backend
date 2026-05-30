import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Query,
} from '@nestjs/common';
import { PublishLiveInfoDto } from './dto/publish-live-info.dto';
import { SubmitLiveInfoWristbandDto } from './dto/submit-wristband.dto';
import { LiveInfoService } from './live-info.service';

@Controller('activities/:legacyId/live-info')
export class LiveInfoController {
  constructor(private readonly liveInfoService: LiveInfoService) {}

  @Get()
  getSnapshot(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.liveInfoService.getSnapshot(legacyId, userId, authorName);
  }

  @Post('wristband')
  submitWristband(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: SubmitLiveInfoWristbandDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.liveInfoService.submitWristband(
      legacyId,
      body,
      userId,
      authorName,
    );
  }

  @Delete('wristband')
  clearWristband(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.liveInfoService.clearWristband(legacyId, userId, authorName);
  }

  @Post('updates')
  publishUpdate(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: PublishLiveInfoDto,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.liveInfoService.publishUpdate(
      legacyId,
      body,
      userId,
      authorName,
    );
  }

  @Post('updates/:updateId/like')
  toggleLike(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Param('updateId') updateId: string,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.liveInfoService.toggleLike(
      legacyId,
      updateId,
      userId,
      authorName,
    );
  }
}
