import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TravelGuideGenerationJob,
  TravelGuideGenerationJobSchema,
} from '../../database/schemas/travel-guide-generation-job.schema';
import { ActivityModule } from '../activity/activity.module';
import { ItineraryModule } from '../itinerary/itinerary.module';
import { PartnerModule } from '../partner/partner.module';
import { TravelGuideModule } from '../travel-guide/travel-guide.module';
import { FestivalPlanController } from './festival-plan.controller';
import { FestivalPlanProgressService } from './festival-plan-progress.service';

@Module({
  imports: [
    ActivityModule,
    ItineraryModule,
    PartnerModule,
    TravelGuideModule,
    MongooseModule.forFeature([
      {
        name: TravelGuideGenerationJob.name,
        schema: TravelGuideGenerationJobSchema,
      },
    ]),
  ],
  controllers: [FestivalPlanController],
  providers: [FestivalPlanProgressService],
  exports: [FestivalPlanProgressService],
})
export class FestivalPlanModule {}
