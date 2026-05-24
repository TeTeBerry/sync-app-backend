import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ index: true })
  sessionId: string;

  @Prop()
  userId?: string;

  @Prop([Object])
  history: Array<{ role: string; content: string }>;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
