import { Module } from '@nestjs/common';
import { DashscopeChatClient } from './dashscope-chat.client';
import { LlmService } from './llm.service';

@Module({
  providers: [DashscopeChatClient, LlmService],
  exports: [DashscopeChatClient, LlmService],
})
export class InfraLlmModule {}
