import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  TravelGuideHotel,
  TravelGuideHotelDocument,
} from '../../../database/schemas/travel-guide-hotel.schema';
import type { TravelGuideBudgetTier } from '../domain/travel-guide.types';
import type { RankedMapPoi } from './travel-guide-map.types';

@Injectable()
export class TravelGuideHotelService {
  constructor(
    @InjectModel(TravelGuideHotel.name)
    private readonly model: Model<TravelGuideHotelDocument>,
  ) {}

  async findRankedForActivity(
    activityLegacyId: number,
    budgetTier: TravelGuideBudgetTier,
  ): Promise<RankedMapPoi[]> {
    const rows = await this.model
      .find({ activityLegacyId, budgetTier })
      .sort({ sortOrder: 1 })
      .lean()
      .exec();

    return rows.map((row) => curatedRowToRankedPoi(row));
  }
}

function curatedRowToRankedPoi(
  row: Pick<
    TravelGuideHotel,
    'name' | 'distanceLabel' | 'distanceM' | 'rating' | 'pricePerNight'
  > & { _id?: { toString(): string } },
): RankedMapPoi {
  const id = row._id != null ? String(row._id) : `curated-${row.name}`;
  return {
    id,
    name: row.name,
    address: '',
    lat: 0,
    lng: 0,
    category: '酒店宾馆',
    distanceM: row.distanceM,
    distanceLabel: row.distanceLabel,
    rating: row.rating,
    avgPrice: row.pricePerNight,
    kind: 'hotel',
    keyword: 'curated',
    lateNightFriendly: false,
    score: 1,
    scoreBreakdown: { distance: 1, rating: 1, budget: 1, lateNight: 0 },
  };
}
