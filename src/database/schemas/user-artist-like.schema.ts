import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserArtistLikeDocument = HydratedDocument<UserArtistLike>;

@Schema({ collection: 'user_artist_likes', timestamps: true })
export class UserArtistLike {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, index: true })
  artistId: string;
}

export const UserArtistLikeSchema =
  SchemaFactory.createForClass(UserArtistLike);
UserArtistLikeSchema.index({ userId: 1, artistId: 1 }, { unique: true });
UserArtistLikeSchema.index({ userId: 1 });
