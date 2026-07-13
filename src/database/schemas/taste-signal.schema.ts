import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TasteSignalDocument = HydratedDocument<TasteSignal>;

export const TASTE_SIGNAL_TYPES = [
  'artist_saved',
  'artist_unsaved',
  'artist_favorited',
  'artist_viewed',
  'artist_detail_engaged',
  'artist_added_to_lineup',
  'artist_removed_from_lineup',
  'journey_generated',
  'journey_artist_added',
  'journey_artist_removed',
  'festival_viewed',
  'festival_saved',
  'mood_selected',
  'constellation_artist_opened',
  'constellation_path_explored',
  'wildcard_opened',
  'recommendation_saved',
] as const;

export type TasteSignalType = (typeof TASTE_SIGNAL_TYPES)[number];

@Schema({ collection: 'taste_signals', timestamps: true })
export class TasteSignal {
  @Prop({ index: true })
  userId?: string;

  @Prop({ index: true })
  anonymousId?: string;

  @Prop({ index: true })
  eventId?: string;

  @Prop({ index: true })
  artistId?: string;

  @Prop({ required: true, index: true })
  signalType: TasteSignalType;

  @Prop()
  mood?: string;

  /** Server-assigned confidence weight — never trust client overrides. */
  @Prop({ required: true })
  weight: number;

  @Prop({ type: Object })
  metadata?: Record<string, unknown>;

  @Prop({ required: true, index: true })
  occurredAt: Date;

  /** TTL for anonymous / transient signals. */
  @Prop({ index: true })
  expiresAt?: Date;

  @Prop()
  source?: 'behavior' | 'legacy-personality' | 'merge';
}

export const TasteSignalSchema = SchemaFactory.createForClass(TasteSignal);
TasteSignalSchema.index({ userId: 1, occurredAt: -1 });
TasteSignalSchema.index({ anonymousId: 1, occurredAt: -1 });
TasteSignalSchema.index({
  userId: 1,
  signalType: 1,
  artistId: 1,
  occurredAt: -1,
});
TasteSignalSchema.index({
  anonymousId: 1,
  signalType: 1,
  artistId: 1,
  occurredAt: -1,
});
TasteSignalSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
