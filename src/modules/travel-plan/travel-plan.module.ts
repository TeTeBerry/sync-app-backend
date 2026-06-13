import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  FestivalSession,
  FestivalSessionSchema,
} from '../../database/schemas/festival-session.schema';
import {
  UserTravelPlan,
  UserTravelPlanSchema,
} from '../../database/schemas/user-travel-plan.schema';
import {
  TravelPlanReceiptRecognizeJob,
  TravelPlanReceiptRecognizeJobSchema,
} from '../../database/schemas/travel-plan-receipt-recognize-job.schema';
import { InfraLlmModule } from '../../infra/llm/llm.module';
import { ActivityModule } from '../activity/activity.module';
import { AuthModule } from '../auth/auth.module';
import { TravelPlanController } from './travel-plan.controller';
import { TravelPlanReceiptRecognizeJobService } from './travel-plan-receipt-recognize-job.service';
import { TravelPlanReceiptRecognizeService } from './travel-plan-receipt-recognize.service';
import { TravelPlanService } from './travel-plan.service';

@Module({
  imports: [
    InfraLlmModule,
    ActivityModule,
    AuthModule,
    MongooseModule.forFeature([
      { name: UserTravelPlan.name, schema: UserTravelPlanSchema },
      { name: FestivalSession.name, schema: FestivalSessionSchema },
      {
        name: TravelPlanReceiptRecognizeJob.name,
        schema: TravelPlanReceiptRecognizeJobSchema,
      },
    ]),
  ],
  controllers: [TravelPlanController],
  providers: [
    TravelPlanService,
    TravelPlanReceiptRecognizeService,
    TravelPlanReceiptRecognizeJobService,
  ],
  exports: [TravelPlanService],
})
export class TravelPlanModule {}
