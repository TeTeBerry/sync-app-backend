import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  ActivityRegistration,
  ActivityRegistrationSchema,
} from '../../database/schemas/activity-registration.schema';
import {
  Activity,
  ActivitySchema,
} from '../../database/schemas/activity.schema';
import { LineupCatalogModule } from '../itinerary/lineup-catalog.module';
import { ActivityLookupModule } from './activity-lookup.module';
import { ActivityCatalogRefreshService } from './activity-catalog-refresh.service';
import { ActivityRegistrationRepository } from './registration/activity-registration.repository';
import { ACTIVITY_REGISTRATION_REPOSITORY } from './registration/interfaces/activity-registration.repository.interface';
import { ACTIVITY_CATALOG_REFRESH_PORT } from './ports/activity-catalog-refresh.port';

/** Lineup catalog mutations → activity lookup cache + publish notifications. */
@Module({
  imports: [
    ActivityLookupModule,
    LineupCatalogModule,
    MongooseModule.forFeature([
      {
        name: Activity.name,
        schema: ActivitySchema,
      },
      {
        name: ActivityRegistration.name,
        schema: ActivityRegistrationSchema,
      },
    ]),
  ],
  providers: [
    ActivityCatalogRefreshService,
    ActivityRegistrationRepository,
    {
      provide: ACTIVITY_REGISTRATION_REPOSITORY,
      useExisting: ActivityRegistrationRepository,
    },
    {
      provide: ACTIVITY_CATALOG_REFRESH_PORT,
      useExisting: ActivityCatalogRefreshService,
    },
  ],
  exports: [ACTIVITY_CATALOG_REFRESH_PORT, ACTIVITY_REGISTRATION_REPOSITORY],
})
export class ActivityCatalogRefreshModule {}
