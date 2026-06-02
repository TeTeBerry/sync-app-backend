import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideHotel,
  TravelGuideHotelDocument,
} from '../../../database/schemas/travel-guide-hotel.schema';
import { TRAVEL_GUIDE_HOTEL_SEED_ROWS } from './travel-guide-hotel.seed.data';

@Injectable()
export class TravelGuideHotelSeedService implements OnModuleInit {
  private readonly logger = new Logger(TravelGuideHotelSeedService.name);

  constructor(
    @InjectModel(TravelGuideHotel.name)
    private readonly model: Model<TravelGuideHotelDocument>,
  ) {}

  async onModuleInit(): Promise<void> {
    for (const row of TRAVEL_GUIDE_HOTEL_SEED_ROWS) {
      await this.model.updateOne(
        {
          activityLegacyId: row.activityLegacyId,
          budgetTier: row.budgetTier,
          name: row.name,
        },
        { $set: row },
        { upsert: true },
      );
    }
    this.logger.log(
      `Travel guide hotels seeded: ${TRAVEL_GUIDE_HOTEL_SEED_ROWS.length} rows`,
    );
  }
}
