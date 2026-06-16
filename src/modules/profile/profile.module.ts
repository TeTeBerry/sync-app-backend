import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { UserModule } from '../user/user.module';
import { ProfileController } from './profile.controller';
import { ProfileSummaryService } from './profile-summary.service';

@Module({
  imports: [ActivityModule, ActivityLookupModule, UserModule],
  controllers: [ProfileController],
  providers: [ProfileSummaryService],
  exports: [ProfileSummaryService],
})
export class ProfileModule {}
