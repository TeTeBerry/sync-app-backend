import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import type { ChatMessageDto, ConversationState } from '../../shared/chat';

export type ChatDocument = HydratedDocument<Chat>;

@Schema({ timestamps: true })
export class Chat {
  @Prop({ index: true })
  sessionId: string;

  @Prop()
  userId?: string;

  @Prop({ type: Object, default: null })
  conversationState?: ConversationState | null;

  @Prop([Object])
  history: ChatMessageDto[];
}

export const ChatSchema = SchemaFactory.createForClass(Chat);
