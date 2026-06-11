import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Activity,
  ActivitySchema,
} from '../../database/schemas/activity.schema';
import { ActivityLookupService } from './activity-lookup.service';
import { ACTIVITY_LOOKUP_PORT } from './ports/activity-lookup.port';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
    ]),
  ],
  providers: [
    ActivityLookupService,
    { provide: ACTIVITY_LOOKUP_PORT, useExisting: ActivityLookupService },
  ],
  exports: [ACTIVITY_LOOKUP_PORT, ActivityLookupService],
})
export class ActivityLookupModule {}
