import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type EventLiveWristbandDocument = HydratedDocument<EventLiveWristband>;

@Schema({ collection: 'event_live_wristbands', timestamps: true })
export class EventLiveWristband {
  @Prop({ required: true, index: true })
  userId!: string;

  @Prop({ required: true, index: true })
  activityLegacyId!: number;

  /** Activity-local calendar day (YYYY-MM-DD, Asia/Shanghai). */
  @Prop({ required: true, index: true })
  eventDate!: string;

  @Prop({ required: true })
  imageUrl!: string;

  @Prop({ required: true, default: 'approved' })
  status!: 'pending' | 'approved' | 'rejected';

  @Prop({ type: Date, required: true })
  validUntil!: Date;

  @Prop()
  authorName?: string;

  @Prop()
  rejectReason?: string;
}

export const EventLiveWristbandSchema =
  SchemaFactory.createForClass(EventLiveWristband);

EventLiveWristbandSchema.index(
  { userId: 1, activityLegacyId: 1, eventDate: 1 },
  { unique: true },
);
