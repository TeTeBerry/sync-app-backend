import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type LineupArtistAvatarDocument = HydratedDocument<LineupArtistAvatar>;

@Schema({ collection: 'lineup_artist_avatars', timestamps: true })
export class LineupArtistAvatar {
  @Prop({ required: true, unique: true, index: true })
  artistNameKey!: string;

  @Prop({ required: true })
  artistName!: string;

  @Prop({ required: true })
  avatarUrl!: string;

  @Prop({ default: 'cloudbase' })
  source!: string;
}

export const LineupArtistAvatarSchema =
  SchemaFactory.createForClass(LineupArtistAvatar);
