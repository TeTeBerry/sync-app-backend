import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, sparse: true, index: true })
  externalId?: string;

  /** WeChat mini program openid (unique per app). */
  @Prop({ unique: true, sparse: true, index: true })
  openid?: string;

  @Prop({ index: true, sparse: true })
  unionid?: string;

  @Prop()
  name: string;

  @Prop()
  handle: string;

  @Prop()
  location: string;

  @Prop()
  bio: string;

  @Prop()
  avatar: string;

  @Prop()
  city: string;

  @Prop([String])
  favorGenres: string[];

  @Prop()
  budgetLevel: string;

  @Prop({ default: true })
  notificationsEnabled: boolean;

  @Prop({ default: 'public', enum: ['public', 'friends', 'private'] })
  privacyLevel: 'public' | 'friends' | 'private';

  /** Incremented on logout to invalidate outstanding JWTs (`tv` claim). */
  @Prop({ default: 0 })
  tokenVersion: number;

  /** `restricted` / `banned` block interaction until `postRestrictedUntil` (field name retained). */
  @Prop({ default: 'normal', enum: ['normal', 'restricted', 'banned'] })
  accountRiskStatus?: 'normal' | 'restricted' | 'banned';

  @Prop({ type: Date })
  postRestrictedUntil?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);
