import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserProfileDocument = HydratedDocument<UserProfile>;

/** Optional Raven preferences, deliberately separate from login identity. */
@Schema({ collection: 'user_profiles', timestamps: true })
export class UserProfile {
  @Prop({ required: true, unique: true, index: true }) userId!: string;
  @Prop() homeAirport?: string;
  @Prop() homeCity?: string;
  @Prop() homeCountry?: string;
  @Prop({ type: [String], default: undefined }) favoriteGenres?: string[];
  @Prop({ type: [String], default: undefined }) favoriteArtistIds?: string[];
  @Prop({ type: [String], default: undefined }) favoriteFestivalIds?: string[];
}

export const UserProfileSchema = SchemaFactory.createForClass(UserProfile);
