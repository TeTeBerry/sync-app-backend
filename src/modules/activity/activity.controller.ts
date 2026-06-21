import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import { Public } from '../../common/auth/public.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ItineraryScheduleService } from '../itinerary/itinerary-schedule.service';
import { ActivityRegistrationService } from './registration/activity-registration.service';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityService } from './activity.service';
import { ActivityLookupService } from './activity-lookup.service';

@Controller('activities')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly activityLookup: ActivityLookupService,
    private readonly registrationService: ActivityRegistrationService,
    private readonly itineraryScheduleService: ItineraryScheduleService,
  ) {}

  @Public()
  @Get('health')
  health() {
    return this.activityService.health();
  }

  @Public()
  @Get()
  list(@Query('skip') skipRaw?: string, @Query('limit') limitRaw?: string) {
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
  resolve(@Query('keyword') keyword: string) {
    return this.activityService.resolveActivityByKeyword(keyword ?? '');
  }

  @Public()
  @Get('lineup-artists')
  listLineupArtists() {
    return this.itineraryScheduleService.listCatalogLineupArtistsRanked();
  }

  @Public()
  @Get(':legacyId')
  getByLegacyId(@Param('legacyId', ParseIntPipe) legacyId: number) {
    return this.activityService.findByLegacyId(legacyId);
  }

  @Patch(':legacyId')
  update(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: UpdateActivityDto,
  ) {
    return this.activityService.updateActivity(legacyId, body);
  }

  @Post(':legacyId/register')
  register(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.registrationService.register(legacyId, actor);
  }

  @Delete(':legacyId/register')
  unregister(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.registrationService.unregister(legacyId, actor);
  }
}
