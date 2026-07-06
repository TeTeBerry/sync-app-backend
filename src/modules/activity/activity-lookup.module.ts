import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  Activity,
  ActivitySchema,
} from '../../database/schemas/activity.schema';
import {
  ArtistPerformance,
  ArtistPerformanceSchema,
} from '../../database/schemas/artist-performance.schema';
import { ActivityImageService } from './activity-image.service';
import { ActivityLookupService } from './activity-lookup.service';
import { ACTIVITY_LOOKUP_PORT } from './ports/activity-lookup.port';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      { name: ArtistPerformance.name, schema: ArtistPerformanceSchema },
    ]),
  ],
  providers: [
    ActivityImageService,
    ActivityLookupService,
    { provide: ACTIVITY_LOOKUP_PORT, useExisting: ActivityLookupService },
  ],
  exports: [ACTIVITY_LOOKUP_PORT, ActivityLookupService, ActivityImageService],
})
export class ActivityLookupModule {}
