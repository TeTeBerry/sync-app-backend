import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';

@Controller('activities')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

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
}
