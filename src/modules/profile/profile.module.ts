import { Module, forwardRef } from '@nestjs/common';
import { ActivityModule } from '../activity/activity.module';
import { PartnerModule } from '../partner/partner.module';
import { UserModule } from '../user/user.module';
import { ProfileController } from './profile.controller';
import { ProfileSummaryService } from './profile-summary.service';

@Module({
  imports: [
    forwardRef(() => ActivityModule),
    forwardRef(() => PartnerModule),
    UserModule,
  ],
  controllers: [ProfileController],
  providers: [ProfileSummaryService],
  exports: [ProfileSummaryService],
})
export class ProfileModule {}
