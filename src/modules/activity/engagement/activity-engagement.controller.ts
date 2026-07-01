import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { ActivityEngagementService } from './activity-engagement.service';
import { RecordActivityEngagementDto } from './dto/record-activity-engagement.dto';

@Controller('activities/:legacyId/engagement')
export class ActivityEngagementController {
  constructor(private readonly engagementService: ActivityEngagementService) {}

  @Post()
  record(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: RecordActivityEngagementDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.engagementService.record(actor, legacyId, body.action);
  }
}
