import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserBlockDocument = HydratedDocument<UserBlock>;

/** One-way block: `userId` has blocked `blockedUserId`. */
@Schema({ timestamps: true })
export class UserBlock {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  blockedUserId: string;
}

export const UserBlockSchema = SchemaFactory.createForClass(UserBlock);
UserBlockSchema.index({ userId: 1, blockedUserId: 1 }, { unique: true });
