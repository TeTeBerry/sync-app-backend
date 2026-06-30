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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { PublicApiRateLimitService } from '../../common/rate-limit/public-api-rate-limit.service';
import { ApiOkEnvelopeResponse } from '../../common/swagger/api-response.decorator';
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

@ApiTags('agent-capabilities')
@Controller('agent-capabilities')
export class AgentCapabilitiesController {
  constructor(
    private readonly service: AgentCapabilitiesService,
    private readonly publicRateLimit: PublicApiRateLimitService,
  ) {}

  @Public()
  @Post('search-festivals')
  @ApiOperation({ summary: 'Search festival catalog (agent capability)' })
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
  @ApiOperation({ summary: 'Get event detail by legacyId (agent capability)' })
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
  @ApiOperation({ summary: 'Get event lineup (agent capability)' })
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
  @ApiOperation({ summary: 'Search public recruit posts (agent capability)' })
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
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Generate recruit post draft (agent capability)' })
  async draftRecruitPost(
    @Body() body: DraftRecruitPostDto,
    @CurrentActor() actor: RequestActor,
  ) {
    requireActorUserId(actor);
    return this.service.draftRecruitPost(body, actor);
  }

  @Post('subscribe-lineup-updates')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Subscribe to lineup updates (agent capability)' })
  async subscribeLineupUpdates(
    @Body() body: SubscribeLineupUpdatesDto,
    @CurrentActor() actor: RequestActor,
  ) {
    requireActorUserId(actor);
    return this.service.subscribeLineupUpdates(body, actor);
  }

  @Post('generate-travel-guide')
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Start travel guide generation job (agent capability)',
  })
  async generateTravelGuide(
    @Body() body: GenerateTravelGuideCapabilityDto,
    @CurrentActor() actor: RequestActor,
  ) {
    requireActorUserId(actor);
    return this.service.generateTravelGuide(body, actor);
  }
}
