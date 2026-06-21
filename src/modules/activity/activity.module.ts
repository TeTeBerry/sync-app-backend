// src/modules/activity/activity.module.ts
import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AgentsModule } from '../../ai/agents/agents.module';
import { InfraChromaModule } from '../../infra/chroma/chroma.module';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { RedisModule } from '../../redis/redis.module';
import {
  Activity,
  ActivitySchema,
} from '../../database/schemas/activity.schema';
import {
  ActivityRegistration,
  ActivityRegistrationSchema,
} from '../../database/schemas/activity-registration.schema';
import { NotificationModule } from '../notification/notification.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { UserModule } from '../user/user.module';
import { ActivityLookupModule } from './activity-lookup.module';
import { ActivityCatalogRefreshService } from './activity-catalog-refresh.service';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityRegistrationRepository } from './registration/activity-registration.repository';
import { ActivityRegistrationService } from './registration/activity-registration.service';
import { ACTIVITY_REGISTRATION_REPOSITORY } from './registration/interfaces/activity-registration.repository.interface';

@Module({
  imports: [
    forwardRef(() => ItineraryModule),
    UserModule,
    ActivityLookupModule,
    AgentsModule,
    NotificationModule,
    InfraChromaModule,
    InfraLlmModule,
    RedisModule,
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      {
        name: ActivityRegistration.name,
        schema: ActivityRegistrationSchema,
      },
    ]),
  ],
  controllers: [ActivityController],
  providers: [
    ActivityService,
    ActivityCatalogRefreshService,
    ActivityRegistrationRepository,
    {
      provide: ACTIVITY_REGISTRATION_REPOSITORY,
      useExisting: ActivityRegistrationRepository,
    },
    ActivityRegistrationService,
  ],
  exports: [
    ActivityService,
    ActivityRegistrationService,
    ACTIVITY_REGISTRATION_REPOSITORY,
    ActivityLookupModule,
  ],
})
export class ActivityModule {}
