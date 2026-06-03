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
import { LIVE_INFO_CATEGORY_IDS } from './domain/live-info-categories';
import type { LiveInfoCategoryId } from './domain/live-info-categories';
import { parseCertifiedOnlyQuery } from './domain/live-info-snapshot-filter.util';
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
    @Query('zoneTag') zoneTag?: string,
    @Query('categoryId') categoryId?: string,
    @Query('certifiedOnly') certifiedOnly?: string,
  ) {
    const parsedCategory = categoryId?.trim();
    const categoryFilter = LIVE_INFO_CATEGORY_IDS.includes(
      parsedCategory as LiveInfoCategoryId,
    )
      ? (parsedCategory as LiveInfoCategoryId)
      : undefined;

    return this.liveInfoService.getSnapshot(legacyId, actor, {
      zoneTag: zoneTag?.trim() || undefined,
      categoryId: categoryFilter,
      certifiedOnly: parseCertifiedOnlyQuery(certifiedOnly),
    });
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
