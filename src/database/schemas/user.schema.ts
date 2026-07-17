import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  /** Identity is minimal and never contains OAuth access/refresh tokens. */
  @Prop({ enum: ['google', 'email'], index: true })
  provider?: 'google' | 'email';

  /** Google `sub` only; not an access token. */
  @Prop({ sparse: true })
  providerUserId?: string;
  @Prop({ unique: true, sparse: true, index: true })
  externalId?: string;

  /** WeChat mini program openid (unique per app). */
  @Prop({ unique: true, sparse: true, index: true })
  openid?: string;

  @Prop({ index: true, sparse: true })
  unionid?: string;

  /**
   * Display email (domain lowercased). Never use as public user id.
   * Temporary Raven email-only auth leaves ownership unverified.
   */
  @Prop()
  email?: string;

  /** Unique lookup key: local-part lowercased + domain lowercased. */
  @Prop({ unique: true, sparse: true, index: true })
  emailNormalized?: string;

  /**
   * Set when email ownership is verified (OTP / magic link / OAuth).
   * Remains null for temporary email-only Raven MVP logins.
   */
  @Prop({ type: Date, default: null })
  emailVerifiedAt?: Date | null;

  @Prop()
  displayName?: string;

  @Prop()
  avatarUrl?: string;

  @Prop({ type: Date })
  lastLoginAt?: Date;

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

  @Prop({ default: 'public', enum: ['public', 'private'] })
  privacyLevel: 'public' | 'private';

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
UserSchema.index(
  { provider: 1, providerUserId: 1 },
  {
    unique: true,
    sparse: true,
    name: 'user_provider_subject_unique',
  },
);
