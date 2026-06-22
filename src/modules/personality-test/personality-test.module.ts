import { Module } from '@nestjs/common';
import { CloudModule } from '@src/infra/cloud/cloud.module';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PersonalityDjCatalog,
  PersonalityDjCatalogSchema,
} from '@src/database/schemas/personality-dj-catalog.schema';
import {
  PersonalityQuestionCatalog,
  PersonalityQuestionCatalogSchema,
} from '@src/database/schemas/personality-question-catalog.schema';
import {
  PersonalityTypeCatalog,
  PersonalityTypeCatalogSchema,
} from '@src/database/schemas/personality-type-catalog.schema';
import {
  UserPersonalityTestResult,
  UserPersonalityTestResultSchema,
} from '@src/database/schemas/user-personality-test-result.schema';
import { ActivityLookupModule } from '../activity/activity-lookup.module';
import { DjModule } from '../dj/dj.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { UserModule } from '../user/user.module';
import { PublicApiRateLimitModule } from '../../common/rate-limit/public-api-rate-limit.module';
import { PersonalityTestCatalogService } from './personality-test-catalog.service';
import { PersonalityTestController } from './personality-test.controller';
import { PersonalityTestService } from './personality-test.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: PersonalityQuestionCatalog.name,
        schema: PersonalityQuestionCatalogSchema,
      },
      {
        name: PersonalityTypeCatalog.name,
        schema: PersonalityTypeCatalogSchema,
      },
      {
        name: PersonalityDjCatalog.name,
        schema: PersonalityDjCatalogSchema,
      },
      {
        name: UserPersonalityTestResult.name,
        schema: UserPersonalityTestResultSchema,
      },
    ]),
    ActivityLookupModule,
    DjModule,
    ItineraryModule,
    UserModule,
    CloudModule,
    PublicApiRateLimitModule,
  ],
  controllers: [PersonalityTestController],
  providers: [PersonalityTestCatalogService, PersonalityTestService],
  exports: [PersonalityTestCatalogService, PersonalityTestService],
})
export class PersonalityTestModule {}
