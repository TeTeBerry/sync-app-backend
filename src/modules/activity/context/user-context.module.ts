import { Module } from '@nestjs/common';
import { ActivityModule } from '../activity.module';
import { ActivityLookupModule } from '../activity-lookup.module';
import { UserGoalModule } from '../../goal/goal.module';
import { PartnerModule } from '../../partner/partner.module';
import { TravelGuideModule } from '../../travel-guide/travel-guide.module';
import { UserModule } from '../../user/user.module';
import { UserContextService } from './user-context.service';

@Module({
  imports: [
    ActivityModule,
    ActivityLookupModule,
    UserGoalModule,
    PartnerModule,
    TravelGuideModule,
    UserModule,
  ],
  providers: [UserContextService],
  exports: [UserContextService],
})
export class UserContextModule {}
