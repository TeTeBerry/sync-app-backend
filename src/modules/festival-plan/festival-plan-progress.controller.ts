import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { FestivalPlanProgressService } from './festival-plan-progress.service';

@Controller('activities/:legacyId/festival-plan-progress')
export class FestivalPlanProgressController {
  constructor(private readonly service: FestivalPlanProgressService) {}

  @Get()
  getProgress(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.service.getProgress(legacyId, actor);
  }
}
