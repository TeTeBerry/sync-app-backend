import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop()
  city: string;

  @Prop([String])
  favorGenres: string[];

  @Prop()
  budgetLevel: string;

  @Prop({ default: false })
  likeMate: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
