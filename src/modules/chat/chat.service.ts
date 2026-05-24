import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { v4 as uuidv4 } from 'uuid';
import { Chat, ChatDocument } from '../../database/schemas/chat.schema';
import { ChatMessageDto } from '../../ai/dto/chat.dto';

@Injectable()
export class ChatService {
  constructor(
    @InjectModel(Chat.name)
    private readonly chatModel: Model<ChatDocument>,
  ) {}

  health() {
    return { ok: true, scope: 'chat' };
  }

  resolveSessionId(sessionId?: string): string {
    return sessionId?.trim() || uuidv4();
  }

  async saveTurn(params: {
    sessionId: string;
    userId?: string;
    messages: ChatMessageDto[];
    assistantReply: string;
  }): Promise<string> {
    const messageId = uuidv4();
    const history = [
      ...params.messages,
      { role: 'assistant' as const, content: params.assistantReply },
    ];

    await this.chatModel.findOneAndUpdate(
      { sessionId: params.sessionId },
      {
        sessionId: params.sessionId,
        userId: params.userId,
        history,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return messageId;
  }

  async getHistory(sessionId: string) {
    return this.chatModel.findOne({ sessionId }).lean();
  }
}
