import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  TripPlan,
  TripPlanSchema,
} from '../../database/schemas/trip-plan.schema';
import { TripPlanController } from './trip-plan.controller';
import { TripPlanService } from './trip-plan.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: TripPlan.name, schema: TripPlanSchema },
    ]),
  ],
  controllers: [TripPlanController],
  providers: [TripPlanService],
  exports: [TripPlanService],
})
export class TripPlanModule {}
