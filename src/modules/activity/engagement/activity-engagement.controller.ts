import { Body, Controller, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentActor } from '../../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../../common/auth/request-actor.types';
import { ActivityEngagementService } from './activity-engagement.service';
import { RecordActivityEngagementDto } from './dto/record-activity-engagement.dto';

@ApiTags('activities')
@Controller('activities/:legacyId/engagement')
export class ActivityEngagementController {
  constructor(private readonly engagementService: ActivityEngagementService) {}

  @Post()
  @ApiBearerAuth('bearer')
  @ApiOperation({ summary: 'Record user engagement signal for an activity' })
  record(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @Body() body: RecordActivityEngagementDto,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.engagementService.record(actor, legacyId, body.action);
  }
}
