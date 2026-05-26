import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationSchema,
} from '../../database/schemas/activity-registration.schema';
import {
  PindanJoin,
  PindanJoinSchema,
} from '../../database/schemas/pindan-join.schema';
import { ActivityModule } from '../activity/activity.module';
import { PindanModule } from '../pindan/pindan.module';
import { PostModule } from '../post/post.module';
import { TicketModule } from '../ticket/ticket.module';
import { NotificationModule } from '../notification/notification.module';
import { UserModule } from '../user/user.module';
import { ACTIVITY_REGISTRATION_REPOSITORY } from './interfaces/activity-registration.repository.interface';
import { ActivityRegistrationRepository } from './activity-registration.repository';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { ProfileSummaryService } from './profile-summary.service';

@Module({
  imports: [
    ActivityModule,
    forwardRef(() => PindanModule),
    TicketModule,
    NotificationModule,
    PostModule,
    UserModule,
    MongooseModule.forFeature([
      { name: PindanJoin.name, schema: PindanJoinSchema },
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
    ProfileService,
    ProfileSummaryService,
  ],
  exports: [ProfileService, ProfileSummaryService],
})
export class ProfileModule {}
