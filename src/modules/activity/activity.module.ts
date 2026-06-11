// src/modules/activity/activity.module.ts
import { Module } from '@nestjs/common';
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
import { UserModule } from '../user/user.module';
import { ActivityLookupModule } from './activity-lookup.module';
import { ActivityCatalogRefreshService } from './activity-catalog-refresh.service';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityRegistrationRepository } from './registration/activity-registration.repository';
import { ActivityRegistrationSeedService } from './registration/activity-registration.seed.service';
import { ActivityRegistrationService } from './registration/activity-registration.service';
import { ACTIVITY_REGISTRATION_REPOSITORY } from './registration/interfaces/activity-registration.repository.interface';

@Module({
  imports: [
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
    ActivityRegistrationSeedService,
  ],
  exports: [
    ActivityService,
    ActivityRegistrationService,
    ACTIVITY_REGISTRATION_REPOSITORY,
  ],
})
export class ActivityModule {}
