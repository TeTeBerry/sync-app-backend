import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationSchema,
} from '../../database/schemas/activity-registration.schema';
import { ActivityModule } from '../activity/activity.module';
import { PostModule } from '../post/post.module';
import { UserModule } from '../user/user.module';
import { ACTIVITY_REGISTRATION_REPOSITORY } from './interfaces/activity-registration.repository.interface';
import { ActivityRegistrationRepository } from './activity-registration.repository';
import { ActivityRegistrationService } from './activity-registration.service';
import { ProfileController } from './profile.controller';
import { ProfileSummaryService } from './profile-summary.service';

@Module({
  imports: [
    forwardRef(() => ActivityModule),
    forwardRef(() => PostModule),
    UserModule,
    MongooseModule.forFeature([
      {
        name: ActivityRegistration.name,
        schema: ActivityRegistrationSchema,
      },
    ]),
  ],
  controllers: [ProfileController],
  providers: [
    ActivityRegistrationRepository,
    {
      provide: ACTIVITY_REGISTRATION_REPOSITORY,
      useExisting: ActivityRegistrationRepository,
    },
    ProfileSummaryService,
    ActivityRegistrationService,
  ],
  exports: [ProfileSummaryService, ActivityRegistrationService],
})
export class ProfileModule {}
