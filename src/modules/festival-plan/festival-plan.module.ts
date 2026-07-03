import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobSchema,
} from '../../database/schemas/travel-guide-generation-job.schema';
import {
  UserItinerary,
  UserItinerarySchema,
} from '../../database/schemas/user-itinerary.schema';
import { FestivalPlanProgressController } from './festival-plan-progress.controller';
import { FestivalPlanProgressService } from './festival-plan-progress.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: TravelGuideGenerationJob.name,
        schema: TravelGuideGenerationJobSchema,
      },
      { name: UserItinerary.name, schema: UserItinerarySchema },
    ]),
  ],
  controllers: [FestivalPlanProgressController],
  providers: [FestivalPlanProgressService],
})
export class FestivalPlanModule {}
