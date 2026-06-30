import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  UserActivityEngagement,
  UserActivityEngagementSchema,
} from '../../../database/schemas/user-activity-engagement.schema';
import { ActivityEngagementController } from './activity-engagement.controller';
import { ActivityEngagementService } from './activity-engagement.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: UserActivityEngagement.name,
        schema: UserActivityEngagementSchema,
      },
    ]),
  ],
  controllers: [ActivityEngagementController],
  providers: [ActivityEngagementService],
  exports: [ActivityEngagementService],
})
export class ActivityEngagementModule {}
