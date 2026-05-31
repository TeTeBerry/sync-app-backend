import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserFreeQuotaDocument = HydratedDocument<UserFreeQuota>;

/** Global monthly free quota counters per user (not per-event). */
@Schema({ timestamps: true })
export class UserFreeQuota {
  @Prop({ required: true, unique: true, index: true })
  userId: string;

  /** Calendar month bucket `YYYY-MM` (UTC). */
  @Prop({ required: true })
  period: string;

  @Prop({ default: 0 })
  aiMatchUsed: number;

  @Prop({ default: 0 })
  contactUnlockUsed: number;
}

export const UserFreeQuotaSchema = SchemaFactory.createForClass(UserFreeQuota);
