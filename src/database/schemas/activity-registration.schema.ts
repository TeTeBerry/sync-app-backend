import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ActivityRegistrationDocument =
  HydratedDocument<ActivityRegistration>;

@Schema({ timestamps: true })
export class ActivityRegistration {
  @Prop({ required: true })
  userId: string;

  @Prop()
  authorName?: string;

  @Prop({ required: true })
  activityLegacyId: number;

  @Prop({ default: 'registered' })
  status: 'registered';

  /** User accepted WeChat subscribe template for activity lineup/info updates. */
  @Prop({ default: false })
  wechatActivityUpdateOptIn?: boolean;
}

export const ActivityRegistrationSchema =
  SchemaFactory.createForClass(ActivityRegistration);
ActivityRegistrationSchema.index(
  { userId: 1, activityLegacyId: 1 },
  { unique: true },
);
/** Index audit: compound index for owner list sorted by createdAt */
ActivityRegistrationSchema.index(
  { userId: 1, createdAt: -1 },
  { name: 'registration_owner_list' },
);
/** Activity attendee sync + WeChat lineup blast — activity-registration.repository.ts */
ActivityRegistrationSchema.index(
  { activityLegacyId: 1, status: 1, wechatActivityUpdateOptIn: 1 },
  { name: 'registration_activity_broadcast' },
);
