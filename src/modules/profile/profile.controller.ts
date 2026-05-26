import { Controller, Get, Query } from '@nestjs/common';
import { ProfileSummaryService } from './profile-summary.service';

@Controller('profile')
export class ProfileController {
  constructor(
    private readonly profileSummaryService: ProfileSummaryService,
  ) {}

  @Get()
  summary(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profileSummaryService.getSummary(userId, authorName);
  }

  @Get('activities')
  listActivities(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profileSummaryService.listActivities(userId, authorName);
  }

  @Get('posts')
  listPosts(
    @Query('userId') userId?: string,
    @Query('authorName') authorName?: string,
  ) {
    return this.profileSummaryService.listPosts(userId, authorName);
  }
}
