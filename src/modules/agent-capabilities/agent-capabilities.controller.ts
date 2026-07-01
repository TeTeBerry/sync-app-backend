import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { AgentCapabilitiesService } from './agent-capabilities.service';
import {
  DraftRecruitPostDto,
  GenerateTravelGuideCapabilityDto,
  SearchFestivalsDto,
  SearchPublicRecruitsDto,
  SubscribeLineupUpdatesDto,
} from './dto/agent-capabilities.dto';

function requireActorUserId(actor: RequestActor): string {
  const userId = actor.resolvedUserId?.trim();
  if (!userId) {
    throw new UnauthorizedException('请先登录');
  }
  return userId;
}

@Controller('agent-capabilities')
export class AgentCapabilitiesController {
  constructor(
    private readonly service: AgentCapabilitiesService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Post('search-festivals')
  async searchFestivals(
    @Body() body: SearchFestivalsDto,
    @Req() req: Request,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'scene_run',
      req,
      actor.resolvedUserId,
    );
    return this.service.searchFestivals(body);
  }

  @Public()
  @Get('events/:legacyId')
  async getEvent(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Req() req: Request,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'scene_run',
      req,
      actor.resolvedUserId,
    );
    return this.service.getEvent({ activityLegacyId: legacyId });
  }

  @Public()
  @Get('events/:legacyId/lineup')
  async getLineup(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Req() req: Request,
    @CurrentActor() actor: RequestActor,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'scene_run',
      req,
      actor.resolvedUserId,
    );
    return this.service.getLineup({ activityLegacyId: legacyId });
  }

  @Public()
  @Post('search-public-recruits')
  async searchPublicRecruits(
    @Body() body: SearchPublicRecruitsDto,
    @CurrentActor() actor: RequestActor,
    @Req() req: Request,
  ) {
    await this.publicRateLimit.assertAllowedAsync(
      'post_ai_search',
      req,
      actor.resolvedUserId,
    );
    return this.service.searchPublicRecruits(body, actor);
  }

  @Post('draft-recruit-post')
  async draftRecruitPost(
    @Body() body: DraftRecruitPostDto,
    @CurrentActor() actor: RequestActor,
  ) {
    requireActorUserId(actor);
    return this.service.draftRecruitPost(body, actor);
  }

  @Post('subscribe-lineup-updates')
  async subscribeLineupUpdates(
    @Body() body: SubscribeLineupUpdatesDto,
    @CurrentActor() actor: RequestActor,
  ) {
    requireActorUserId(actor);
    return this.service.subscribeLineupUpdates(body, actor);
  }

  @Post('generate-travel-guide')
  async generateTravelGuide(
    @Body() body: GenerateTravelGuideCapabilityDto,
    @CurrentActor() actor: RequestActor,
  ) {
    requireActorUserId(actor);
    return this.service.generateTravelGuide(body, actor);
  }
}
