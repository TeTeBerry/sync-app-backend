import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { ConversationState } from '../../ai/conversation';

export type ChatDocument = Chat & Document;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ index: true })
  sessionId: string;

  @Prop()
  userId?: string;

  @Prop({ type: Object, default: null })
  conversationState?: ConversationState | null;

  @Prop([Object])
  history: Array<{ role: string; content: string }>;
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
