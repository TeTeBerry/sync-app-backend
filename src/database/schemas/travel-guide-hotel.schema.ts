import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { TravelGuideBudgetTier } from '../../modules/travel-guide/domain/travel-guide.types';

@Schema({ collection: 'travel_guide_hotels', timestamps: true })
export class TravelGuideHotel {
  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop({ required: true, enum: ['economy', 'standard', 'comfort'] })
  budgetTier!: TravelGuideBudgetTier;

  @Prop({ required: true })
  name!: string;

  /** 如「步行1.3公里」「驾车2.6公里」 */
  @Prop({ required: true })
  distanceLabel!: string;

  @Prop({ required: true })
  distanceM!: number;

  @Prop({ required: true })
  rating!: number;

  /** 起步价（元/晚） */
  @Prop({ required: true })
  pricePerNight!: number;

  @Prop({ required: true, default: 0 })
  sortOrder!: number;
}

export type TravelGuideHotelDocument = HydratedDocument<TravelGuideHotel>;

export const TravelGuideHotelSchema =
  SchemaFactory.createForClass(TravelGuideHotel);

TravelGuideHotelSchema.index(
  { activityLegacyId: 1, budgetTier: 1, sortOrder: 1 },
  { unique: false },
);
