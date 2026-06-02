import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { TravelGuidePlan } from '../../modules/travel-guide/domain/travel-guide.types';

@Schema({ collection: 'travel_guide_generation_cache', timestamps: true })
export class TravelGuideGenerationCache {
  @Prop({ required: true, unique: true })
  cacheKey!: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop({ type: Object, required: true })
  plan!: TravelGuidePlan;

  /** 与请求参数一致，便于运维核对 */
  @Prop({ type: Object, required: true })
  requestParams!: Record<string, unknown>;
}

export type TravelGuideGenerationCacheDocument =
  HydratedDocument<TravelGuideGenerationCache>;

export const TravelGuideGenerationCacheSchema = SchemaFactory.createForClass(
  TravelGuideGenerationCache,
);
