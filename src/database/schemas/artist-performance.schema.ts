import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ArtistPerformanceDocument = ArtistPerformance & Document;

@Schema({ collection: 'artist_performances', timestamps: true })
export class ArtistPerformance {
  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  @Prop({ required: true, index: true })
  dateKey!: string;

  @Prop({ required: true })
  dateLabel!: string;

  @Prop({ required: true, index: true })
  artistId!: string;

  @Prop({ required: true })
  artistName!: string;

  @Prop({ required: true })
  genre!: string;

  @Prop({ required: true })
  genreLabel!: string;

  @Prop({ required: true })
  stage!: string;

  @Prop({ required: true })
  stageLabel!: string;

  @Prop({ required: true })
  startTime!: string;

  @Prop({ required: true })
  endTime!: string;

  /** Minutes from midnight (0–1440+) for overlap detection. */
  @Prop({ required: true })
  startMinutes!: number;

  @Prop({ required: true })
  endMinutes!: number;

  @Prop({ default: 80 })
  popularity!: number;

  @Prop({ default: '' })
  avatarSeed!: string;

  @Prop({ default: '#ff2d55' })
  genreColor!: string;
}

export const ArtistPerformanceSchema =
  SchemaFactory.createForClass(ArtistPerformance);

ArtistPerformanceSchema.index(
  { activityLegacyId: 1, dateKey: 1, artistId: 1 },
  { unique: true },
);
ArtistPerformanceSchema.index({ activityLegacyId: 1, dateKey: 1 });
