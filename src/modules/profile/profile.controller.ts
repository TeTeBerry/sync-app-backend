import { Controller, Get, Query } from '@nestjs/common';
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

  @Get('posts')
  listPosts(
    @CurrentActor() actor: RequestActor,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : undefined;
    const safeLimit =
      parsedLimit != null && !Number.isNaN(parsedLimit)
        ? Math.min(Math.max(parsedLimit, 1), 50)
        : undefined;
    if (safeLimit != null || cursor) {
      return this.profileSummaryService.listPostsPage(actor, {
        limit: safeLimit,
        cursor,
      });
    }
    return this.profileSummaryService.listPosts(actor);
  }
}
