import {
  Body,
  Controller,
  Delete,
  Get,
  Inject,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import {
  ApiOkEnvelopeArrayResponse,
  ApiOkEnvelopeResponse,
} from '../../common/swagger/api-response.decorator';
import {
  ActivityHealthDto,
  ActivityRegistrationResultDto,
  ActivityResolveResultDto,
  ActivityUnregisterResultDto,
  ActivityWechatUpdateOptInResultDto,
  BackendActivityDto,
  CatalogLineupArtistDto,
} from '../../common/swagger/dto/activity.swagger.dto';
import {
  LINEUP_CATALOG_PORT,
  type ILineupCatalogPort,
} from '../itinerary/ports/lineup-catalog.port';
import { ActivityRegistrationService } from './registration/activity-registration.service';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityService } from './activity.service';
import { ActivityLookupService } from './activity-lookup.service';

@ApiTags('activities')
@Controller('activities')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly activityLookup: ActivityLookupService,
    private readonly registrationService: ActivityRegistrationService,
    @Inject(LINEUP_CATALOG_PORT)
    private readonly lineupCatalog: ILineupCatalogPort,
  ) {}

  @Public()
  @Get('health')
  @ApiOperation({ summary: 'Activity module health check' })
  @ApiOkEnvelopeResponse(ActivityHealthDto)
  health() {
    return this.activityService.health();
  }

  @Public()
  @Get()
  @ApiOperation({ summary: 'List activities or paginate by lineup artist' })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'lineupArtistId', required: false, type: String })
  @ApiOkEnvelopeArrayResponse(BackendActivityDto)
  list(
    @Query('skip') skipRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('lineupArtistId') lineupArtistId?: string,
  ) {
    if (lineupArtistId?.trim()) {
      return this.lineupCatalog.listActivitiesForLineupArtist(
        lineupArtistId.trim(),
      );
    }

    if (skipRaw != null || limitRaw != null) {
      const skip = Number(skipRaw);
      const limit = Number(limitRaw);
      return this.activityLookup.findPage({
        skip: Number.isFinite(skip) ? skip : 0,
        limit: Number.isFinite(limit) ? limit : undefined,
      });
    }
    return this.activityLookup.findAll();
  }

  @Public()
  @Get('resolve')
  @ApiOperation({ summary: 'Resolve activity by keyword' })
  @ApiQuery({ name: 'keyword', required: true, type: String })
  @ApiOkEnvelopeResponse(ActivityResolveResultDto)
  resolve(@Query('keyword') keyword: string) {
    return this.activityService.resolveActivityByKeyword(keyword ?? '');
  }

  @Public()
  @Get('lineup-artists')
  @ApiOperation({ summary: 'List ranked lineup artists catalog' })
  @ApiOkEnvelopeArrayResponse(CatalogLineupArtistDto)
  listLineupArtists() {
    return this.lineupCatalog.listCatalogLineupArtistsRanked();
  }

  @Public()
  @Get(':legacyId')
  @ApiOperation({ summary: 'Get activity detail by legacyId' })
  @ApiOkEnvelopeResponse(BackendActivityDto)
  getByLegacyId(@Param('legacyId', ParseIntPipe) legacyId: number) {
    return this.activityService.findByLegacyId(legacyId);
  }

  @Patch(':legacyId')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Update activity metadata' })
  @ApiOkEnvelopeResponse(BackendActivityDto)
  update(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: UpdateActivityDto,
  ) {
    return this.activityService.updateActivity(legacyId, body);
  }

  @Post(':legacyId/register')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Register current user for activity' })
  @ApiOkEnvelopeResponse(ActivityRegistrationResultDto)
  register(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.registrationService.register(legacyId, actor);
  }

  @Post(':legacyId/register/wechat-updates')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Opt in to WeChat activity update notifications' })
  @ApiOkEnvelopeResponse(ActivityWechatUpdateOptInResultDto)
  optInWechatActivityUpdates(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.registrationService.optInWechatActivityUpdates(legacyId, actor);
  }

  @Delete(':legacyId/register')
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Unregister current user from activity' })
  @ApiOkEnvelopeResponse(ActivityUnregisterResultDto)
  unregister(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.registrationService.unregister(legacyId, actor);
  }
}
