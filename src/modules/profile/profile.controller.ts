import { Controller, Get } from '@nestjs/common';
import { CurrentActor } from '../../common/auth/current-actor.decorator';
import type { RequestActor } from '../../common/auth/request-actor.types';
import { ProfileSummaryService } from './profile-summary.service';

@Controller('profile')
export class ProfileController {
  constructor(private readonly profileSummaryService: ProfileSummaryService) {}

  @Get()
  summary(@CurrentActor() actor: RequestActor) {
    return this.profileSummaryService.getSummary(actor);
  }

  @Get('activities')
  listActivities(@CurrentActor() actor: RequestActor) {
    return this.profileSummaryService.listActivities(actor);
  }

  @Get('footprints')
  listFootprints(@CurrentActor() actor: RequestActor) {
    return this.profileSummaryService.listFootprints(actor);
  }
}
