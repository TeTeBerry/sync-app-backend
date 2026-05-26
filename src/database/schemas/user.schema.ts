import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ unique: true, sparse: true, index: true })
  externalId?: string;

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

  @Prop({ default: false })
  likeMate: boolean;

  @Prop({ default: true })
  notificationsEnabled: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
