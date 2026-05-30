import {
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Body,
  Post,
  Query,
} from '@nestjs/common';
import { ActivityRegistrationService } from './registration/activity-registration.service';
import { UpdateActivityDto } from './dto/update-activity.dto';
import { ActivityService } from './activity.service';

@Controller('activities')
export class ActivityController {
  constructor(
    private readonly activityService: ActivityService,
    private readonly registrationService: ActivityRegistrationService,
  ) {}

  @Get('health')
  health() {
    return this.activityService.health();
  }

  @Get()
  list() {
    return this.activityService.findAll();
  }

  @Get('match')
  match(@Query('keyword') keyword: string) {
    return this.activityService.matchActivity(keyword ?? '');
  }

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
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.registrationService.register(legacyId, userId, authorName);
  }

  @Delete(':legacyId/register')
  unregister(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.registrationService.unregister(legacyId, userId, authorName);
  }
}
