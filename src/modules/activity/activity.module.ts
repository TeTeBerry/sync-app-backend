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
import {
  ActivitySetVote,
  ActivitySetVoteSchema,
} from '../../database/schemas/activity-set-vote.schema';
import { NotificationModule } from '../notification/notification.module';
import { LineupCatalogModule } from '../itinerary/lineup-catalog.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { UserGoalModule } from '../goal/goal.module';
import { UserModule } from '../user/user.module';
import { ActivityLookupModule } from './activity-lookup.module';
import { ActivityCatalogRefreshModule } from './activity-catalog-refresh.module';
import { ActivityController } from './activity.controller';
import { ActivityService } from './activity.service';
import { ActivityRegistrationRepository } from './registration/activity-registration.repository';
import { ActivityRegistrationService } from './registration/activity-registration.service';
import { ACTIVITY_REGISTRATION_REPOSITORY } from './registration/interfaces/activity-registration.repository.interface';
import { SetVoteController } from './set-vote/set-vote.controller';
import { SetVoteRepository } from './set-vote/set-vote.repository';
import { SetVoteService } from './set-vote/set-vote.service';
import { SET_VOTE_REPOSITORY } from './set-vote/interfaces/set-vote.repository.interface';
import { ActivityEngagementModule } from './engagement/activity-engagement.module';

@Module({
  imports: [
    ActivityEngagementModule,
    LineupCatalogModule,
    ItineraryModule,
    UserModule,
    ActivityLookupModule,
    ActivityCatalogRefreshModule,
    AgentsModule,
    NotificationModule,
    InfraChromaModule,
    InfraLlmModule,
    RedisModule,
    forwardRef(() => UserGoalModule),
    MongooseModule.forFeature([
      { name: Activity.name, schema: ActivitySchema },
      {
        name: ActivityRegistration.name,
        schema: ActivityRegistrationSchema,
      },
      {
        name: ActivitySetVote.name,
        schema: ActivitySetVoteSchema,
      },
    ]),
  ],
  controllers: [ActivityController, SetVoteController],
  providers: [
    ActivityService,
    ActivityRegistrationRepository,
    {
      provide: ACTIVITY_REGISTRATION_REPOSITORY,
      useExisting: ActivityRegistrationRepository,
    },
    ActivityRegistrationService,
    SetVoteRepository,
    {
      provide: SET_VOTE_REPOSITORY,
      useExisting: SetVoteRepository,
    },
    SetVoteService,
  ],
  exports: [
    ActivityService,
    ActivityRegistrationService,
    ACTIVITY_REGISTRATION_REPOSITORY,
    ActivityLookupModule,
    ActivityCatalogRefreshModule,
    ActivityEngagementModule,
    SetVoteService,
  ],
})
export class ActivityModule {}
