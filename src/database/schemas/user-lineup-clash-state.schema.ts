import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserLineupClashStateDocument =
  HydratedDocument<UserLineupClashState>;

@Schema({ collection: 'user_lineup_clash_states', timestamps: true })
export class UserLineupClashState {
  @Prop({ index: true })
  userId?: string;

  @Prop({ index: true })
  anonymousId?: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  /** Schedule fingerprint — stale when timetable changes. */
  @Prop({ required: true })
  scheduleVersion!: string;

  @Prop({ type: [String], default: [] })
  deferredArtistIds!: string[];

  @Prop({ type: [String], default: [] })
  journeyArtistIds!: string[];

  @Prop({ type: [Object], default: [] })
  resolutions!: Array<{
    conflictId: string;
    optionType: string;
    keptArtistId?: string;
    deferredArtistId?: string;
    watchWindows?: Array<{
      artistId: string;
      watchFrom?: string;
      watchUntil?: string;
      missedMinutes?: number;
    }>;
    scheduleVersion: string;
    resolvedAt: string;
    needsReview?: boolean;
  }>;

  @Prop()
  routeVersion?: string;
}

export const UserLineupClashStateSchema =
  SchemaFactory.createForClass(UserLineupClashState);

UserLineupClashStateSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true, sparse: true },
);
UserLineupClashStateSchema.index(
  { anonymousId: 1, activityLegacyId: 1 },
  { unique: true, sparse: true },
);
