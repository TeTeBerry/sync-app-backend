import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TasteSignal,
  TasteSignalSchema,
} from '@src/database/schemas/taste-signal.schema';
import {
  PersonalityTasteMigration,
  PersonalityTasteMigrationSchema,
} from '@src/database/schemas/personality-taste-migration.schema';
import {
  UserPersonalityTestResult,
  UserPersonalityTestResultSchema,
} from '@src/database/schemas/user-personality-test-result.schema';
import {
  UserItinerary,
  UserItinerarySchema,
} from '@src/database/schemas/user-itinerary.schema';
import { PublicApiRateLimitModule } from '../../common/rate-limit/public-api-rate-limit.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { LineupDiscoveryController } from './lineup-discovery.controller';
import { LineupDiscoveryService } from './lineup-discovery.service';
import { LegacyPersonalityMigrationService } from './legacy-personality-migration.service';
import { TasteSignalsRepository } from './taste-signals.repository';

@Module({
  imports: [
    ItineraryModule,
    PublicApiRateLimitModule,
    MongooseModule.forFeature([
      { name: TasteSignal.name, schema: TasteSignalSchema },
      {
        name: PersonalityTasteMigration.name,
        schema: PersonalityTasteMigrationSchema,
      },
      {
        name: UserPersonalityTestResult.name,
        schema: UserPersonalityTestResultSchema,
      },
      { name: UserItinerary.name, schema: UserItinerarySchema },
    ]),
  ],
  controllers: [LineupDiscoveryController],
  providers: [
    TasteSignalsRepository,
    LegacyPersonalityMigrationService,
    LineupDiscoveryService,
  ],
  exports: [LineupDiscoveryService, TasteSignalsRepository],
})
export class LineupDiscoveryModule {}
