import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../../ai/agents/agents.module';
import {
  ActivityRegistration,
  ActivityRegistrationSchema,
} from '../../database/schemas/activity-registration.schema';
import { ActivityLookupModule } from './activity-lookup.module';
import { ActivityCatalogRefreshService } from './activity-catalog-refresh.service';
import { ActivityRegistrationRepository } from './registration/activity-registration.repository';
import { ACTIVITY_REGISTRATION_REPOSITORY } from './registration/interfaces/activity-registration.repository.interface';
import { ACTIVITY_CATALOG_REFRESH_PORT } from './ports/activity-catalog-refresh.port';

/** Lineup catalog mutations → activity lookup cache + publish notifications. */
@Module({
  imports: [
    ActivityLookupModule,
    AgentsModule,
    MongooseModule.forFeature([
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
  exports: [ACTIVITY_CATALOG_REFRESH_PORT],
})
export class ActivityCatalogRefreshModule {}
