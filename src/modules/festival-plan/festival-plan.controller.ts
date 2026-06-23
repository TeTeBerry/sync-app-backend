import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { FestivalPlanProgressService } from './festival-plan-progress.service';

@Controller('activities/:legacyId/festival-plan-progress')
export class FestivalPlanController {
  constructor(
    private readonly festivalPlanProgressService: FestivalPlanProgressService,
  ) {}

  @Get()
  getProgress(
    @Param('legacyId', ParseIntPipe) legacyId: number,
    @CurrentActor() actor: RequestActor,
  ) {
    return this.festivalPlanProgressService.getProgress(legacyId, actor);
  }
}
