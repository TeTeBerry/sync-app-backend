import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ _id: false })
export class TravelGuideCachedRoute {
  @Prop({ required: true })
  hubKey!: string;

  @Prop({ required: true })
  hubLabel!: string;

  @Prop({ required: true })
  hubLat!: number;

  @Prop({ required: true })
  hubLng!: number;

  @Prop({ type: [String], default: [] })
  departureAliases!: string[];

  @Prop({ type: Object })
  driving?: {
    distanceM: number;
    durationSec: number;
    distanceKm: number;
    durationMin: number;
  };

  @Prop()
  transitHint?: string;

  @Prop()
  walkingHint?: string;
}

@Schema({ _id: false })
export class TravelGuideCachedVenue {
  @Prop({ required: true })
  title!: string;

  @Prop({ required: true })
  address!: string;

  @Prop({ required: true })
  lat!: number;

  @Prop({ required: true })
  lng!: number;
}

@Schema({ collection: 'travel_guide_venue_cache', timestamps: true })
export class TravelGuideVenueCache {
  @Prop({ required: true, unique: true })
  activityLegacyId!: number;

  @Prop({ required: true })
  activityCode!: string;

  @Prop({ type: TravelGuideCachedVenue, required: true })
  venue!: TravelGuideCachedVenue;

  @Prop({ required: true })
  readableAddress!: string;

  @Prop({ type: [TravelGuideCachedRoute], default: [] })
  hubRoutes!: TravelGuideCachedRoute[];

  @Prop()
  poiCacheExpiresAt?: Date;
}

export type TravelGuideVenueCacheDocument =
  HydratedDocument<TravelGuideVenueCache>;

export const TravelGuideVenueCacheSchema =
  SchemaFactory.createForClass(TravelGuideVenueCache);
